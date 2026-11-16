import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { vertexShader, fragmentShader } from './shaders';
import { generateShape, seededRandom } from './shapes';
import type { Interaction, Palette, SceneSettings, SceneStats, Shape } from '../types';

const CAPACITY = 40000;
export const PALETTES: Record<Palette, string[]> = {
  cosmic: ['#3f57ee', '#ab6bff', '#84caff'],
  ocean: ['#1d4fea', '#19c6de', '#a1f5ff'],
  aurora: ['#5637e0', '#42e6b0', '#c0ffe5'],
  sunset: ['#6c3ae0', '#f76a9c', '#ffd3a1'],
};

export class ParticleEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private stars: THREE.Points;
  private orbits = new THREE.Group();
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private trailPass: AfterimagePass;
  private resizeObserver: ResizeObserver;
  private shapeCache = new Map<Shape, Float32Array>();
  private frame = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private frames = 0;
  private sampleTime = performance.now();
  private warmup = performance.now();
  private slowSamples = 0;
  private lastAdapt = 0;
  private activeCount = 20000;
  private lowQuality = false;
  private idleAngle = 0;
  private pointer = { x: 0, y: 0, down: false, inside: false, scale: 1 };
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private localAttractor = new THREE.Vector3();
  private disposed = false;

  constructor(private container: HTMLElement, private settings: SceneSettings,
    private interaction: Interaction, private onStats: (stats: SceneStats) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(max-width: 700px)').matches ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);
    this.camera.position.z = 8.8;
    const pos = this.getShape(settings.shape);
    const random = seededRandom(11);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aTarget', new THREE.BufferAttribute(pos.slice(), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: CAPACITY }, () => random()), 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uMorph: { value: 0 }, uSpread: { value: 0 }, uScale: { value: 1 },
        uSize: { value: settings.pointSize }, uPixelRatio: { value: this.renderer.getPixelRatio() },
        uExplosion: { value: settings.shape === 'explosion' ? 1 : 0 },
        uAttractor: { value: new THREE.Vector3() },
        uColorA: { value: new THREE.Color(PALETTES[settings.palette][0]) },
        uColorB: { value: new THREE.Color(PALETTES[settings.palette][1]) },
        uColorC: { value: new THREE.Color(PALETTES[settings.palette][2]) },
      },
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.stars = this.createStars(); this.scene.add(this.stars);
    this.createOrbits(); this.scene.add(this.orbits);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.65, 0.6, 0.3);
    this.trailPass = new AfterimagePass(0.74);
    this.composer.addPass(this.trailPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    window.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('wheel', this.wheel, { passive: true });
    canvas.addEventListener('webglcontextlost', this.contextLost);
    document.addEventListener('visibilitychange', this.visibilityChange);
    this.setCount(); this.resize(); this.animate();
  }
  private getShape(shape: Shape) {
    if (!this.shapeCache.has(shape)) this.shapeCache.set(shape, generateShape(shape, CAPACITY));
    return this.shapeCache.get(shape)!;
  }
  private createStars() {
    const random = seededRandom(174);
    const geometry = new THREE.BufferGeometry();
    const p = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) p.set([(random() - 0.5) * 35, (random() - 0.5) * 24, -3 - random() * 18], i * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x8d9aba, size: 0.018, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true }));
  }
  private createOrbits() {
    for (let j = 0; j < 2; j++) {
      const points = Array.from({ length: 256 }, (_, i) => {
        const a = i / 256 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * (3.05 + j * 0.3), Math.sin(a) * (3.05 + j * 0.3), 0);
      });
      const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: j ? 0x4c4f9a : 0x7375c8, transparent: true, opacity: j ? 0.075 : 0.13, depthWrite: false }));
      orbit.rotation.set(1.15 + j * 0.35, 0.35, -0.35 + j * 0.5);
      this.orbits.add(orbit);
    }
  }
  update(settings: SceneSettings) {
    const previous = this.settings;
    this.settings = settings;
    if (settings.resetKey !== previous.resetKey) {
      this.pointer.scale = 1; this.idleAngle = 0;
      this.pointer.down = false; this.pointer.inside = false;
      this.restoreQuality(); this.setCount();
    }
    if (settings.shape !== previous.shape) this.morph(settings.shape);
    if (settings.count !== previous.count || settings.autoCount !== previous.autoCount) this.setCount();
    if (settings.palette !== previous.palette) {
      PALETTES[settings.palette].forEach((hex, i) => {
        const color = new THREE.Color(hex);
        gsap.to(this.material.uniforms[['uColorA', 'uColorB', 'uColorC'][i]].value, { r: color.r, g: color.g, b: color.b, duration: 0.8 });
      });
    }
  }
  private setCount() {
    if (!this.settings.autoCount && this.lowQuality) this.restoreQuality();
    const constrained = matchMedia('(max-width: 700px)').matches || navigator.hardwareConcurrency <= 4;
    this.activeCount = this.settings.autoCount ? (constrained ? 12000 : 20000) : this.settings.count;
    this.slowSamples = 0; this.lastAdapt = performance.now();
    this.geometry.setDrawRange(0, this.activeCount);
  }
  private restoreQuality() {
    this.lowQuality = false;
    const ratio = Math.min(devicePixelRatio, matchMedia('(max-width: 700px)').matches ? 1.5 : 2);
    this.renderer.setPixelRatio(ratio); this.composer.setPixelRatio(ratio);
    this.material.uniforms.uPixelRatio.value = ratio; this.resize();
  }
  private morph(shape: Shape) {
    gsap.to(this.material.uniforms.uExplosion, { value: shape === 'explosion' ? 1 : 0, duration: 1.75, overwrite: true });
    const u = this.material.uniforms.uMorph;
    gsap.killTweensOf(u);
    const from = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const to = this.geometry.getAttribute('aTarget') as THREE.BufferAttribute;
    const f = from.array as Float32Array, t = to.array as Float32Array;
    for (let i = 0; i < f.length; i++) f[i] += (t[i] - f[i]) * u.value;
    from.needsUpdate = true;
    t.set(this.getShape(shape)); to.needsUpdate = true;
    u.value = 0;
    gsap.to(u, { value: 1, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1.75, ease: 'power2.inOut' });
  }
  private resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h); this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.position.z = w < 700 ? 13.5 : 11.3;
    this.camera.setViewOffset(w, h, w > 1100 ? w * 0.045 : w > 700 ? w * 0.08 : 0, w < 700 ? h * -0.02 : h * 0.05, w, h);
    this.camera.updateProjectionMatrix();
  }
  private pointerMove = (e: PointerEvent) => {
    const rect = this.container.getBoundingClientRect();
    this.pointer.x = (e.clientX - rect.left) / rect.width * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.inside = true;
  };
  private pointerDown = (e: PointerEvent) => { this.pointerMove(e); this.pointer.down = true; };
  private pointerUp = () => { this.pointer.down = false; };
  private pointerLeave = () => { this.pointer.inside = false; this.pointer.down = false; };
  private wheel = (e: WheelEvent) => {
    if (this.settings.mouse && !this.interaction.active) this.pointer.scale = THREE.MathUtils.clamp(this.pointer.scale - e.deltaY * 0.001, 0.5, 1.8);
  };
  private visibilityChange = () => {
    this.lastTime = performance.now(); this.sampleTime = this.lastTime; this.frames = 0;
    if (!document.hidden && !this.frame && !this.disposed) this.animate();
  };
  private contextLost = (e: Event) => {
    e.preventDefault(); cancelAnimationFrame(this.frame); this.frame = 0;
    this.container.dispatchEvent(new CustomEvent('scene-error', { detail: '图形上下文已丢失，请刷新页面恢复粒子场景。' }));
  };
  private animate = () => {
    if (this.disposed || document.hidden) { this.frame = 0; return; }
    this.frame = requestAnimationFrame(this.animate);
    const now = performance.now(), dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now; this.elapsed += dt * this.settings.speed;
    const u = this.material.uniforms, input = this.interaction;
    const mouse = this.settings.mouse && !input.active;
    const smooth = 1 - Math.exp(-dt * 5);
    u.uTime.value = this.elapsed;
    u.uSpread.value += (input.spread - u.uSpread.value) * smooth;
    const targetScale = input.scale * (mouse ? this.pointer.scale : 1);
    u.uScale.value += (targetScale - u.uScale.value) * smooth;
    u.uSize.value = this.settings.pointSize;
    if (this.settings.rotation) this.idleAngle += dt * 0.075 * this.settings.speed;
    const angle = this.idleAngle + input.rotation + (mouse && this.pointer.inside ? this.pointer.x * 0.45 : 0);
    this.points.rotation.y += (angle - this.points.rotation.y) * smooth;
    this.points.rotation.x += ((mouse && this.pointer.inside ? -this.pointer.y * 0.16 : 0.08) - this.points.rotation.x) * smooth;
    this.points.updateMatrixWorld();
    const ax = input.active ? input.attractor.x : this.pointer.x;
    const ay = input.active ? input.attractor.y : this.pointer.y;
    this.pointerNdc.set(ax, ay);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.localAttractor);
    this.points.worldToLocal(this.localAttractor);
    const strength = input.active ? input.attractor.strength : mouse && this.pointer.down ? 1.4 : 0;
    const attractor = u.uAttractor.value as THREE.Vector3;
    attractor.x += (this.localAttractor.x - attractor.x) * smooth;
    attractor.y += (this.localAttractor.y - attractor.y) * smooth;
    attractor.z += (strength - attractor.z) * smooth;
    this.stars.rotation.z = this.elapsed * 0.002;
    this.orbits.rotation.z = Math.sin(this.elapsed * 0.06) * 0.15;
    this.bloomPass.enabled = this.settings.bloom && !this.lowQuality;
    this.trailPass.enabled = this.settings.trails && !this.lowQuality;
    this.trailPass.uniforms.damp.value = Math.pow(0.74, Math.max(dt, 0.001) * 60);
    this.composer.render(dt);
    this.frames++;
    if (now - this.sampleTime >= 1000) {
      const fps = Math.round(this.frames * 1000 / (now - this.sampleTime));
      if (now - this.warmup > 5000 && this.settings.autoCount) {
        this.slowSamples = fps < 36 ? this.slowSamples + 1 : 0;
        if (this.slowSamples >= 3 && now - this.lastAdapt > 6000) {
          this.activeCount = Math.max(5000, Math.floor(this.activeCount * 0.75 / 1000) * 1000);
          this.geometry.setDrawRange(0, this.activeCount);
          if (this.activeCount <= 8000 && !this.lowQuality) {
            this.lowQuality = true; this.renderer.setPixelRatio(1);
            this.composer.setPixelRatio(1); u.uPixelRatio.value = 1; this.resize();
          }
          this.lastAdapt = now; this.slowSamples = 0;
        }
      }
      this.onStats({ fps, count: this.activeCount, quality: this.lowQuality ? 'LITE' : this.activeCount < 15000 ? 'BALANCED' : 'HIGH' });
      this.frames = 0; this.sampleTime = now;
    }
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame); this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.pointerMove);
    canvas.removeEventListener('pointerdown', this.pointerDown);
    canvas.removeEventListener('pointerleave', this.pointerLeave);
    canvas.removeEventListener('wheel', this.wheel);
    canvas.removeEventListener('webglcontextlost', this.contextLost);
    window.removeEventListener('pointerup', this.pointerUp);
    document.removeEventListener('visibilitychange', this.visibilityChange);
    gsap.killTweensOf(this.material.uniforms.uMorph);
    gsap.killTweensOf(this.material.uniforms.uExplosion);
    ['uColorA', 'uColorB', 'uColorC'].forEach(key => gsap.killTweensOf(this.material.uniforms[key].value));
    this.geometry.dispose(); this.material.dispose();
    this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose();
    this.orbits.children.forEach(child => { const line = child as THREE.Line; line.geometry.dispose(); (line.material as THREE.Material).dispose(); });
    this.composer.passes.forEach(pass => pass.dispose()); this.composer.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove(); this.shapeCache.clear();
  }
}
