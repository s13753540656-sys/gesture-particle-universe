import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Orbit, Maximize, Minimize, RotateCcw, CircleHelp, MousePointer2, Hand, ArrowUpRight, Expand, Shrink, Heart, Plus, Minus, Magnet, X, SlidersHorizontal } from 'lucide-react';
import { ParticleScene } from './components/ParticleScene';
import { CameraPanel } from './components/CameraPanel';
import { ControlPanel, SHAPES } from './components/ControlPanel';
import { GestureGuide, GUIDES } from './components/GestureGuide';
import { createInteraction, type SceneSettings, type SceneStats } from './types';
import { useHandTracking } from './hooks/useHandTracking';
import { GestureController, type GestureStatus } from './vision/gestures';

const DEFAULTS: SceneSettings = { shape: 'sphere', palette: 'cosmic', count: 20000, autoCount: true, bloom: true, trails: true, rotation: true, mouse: true, speed: 1, pointSize: 3.2, resetKey: 0 };
export default function App() {
  const root = useRef<HTMLElement>(null);
  const interaction = useRef(createInteraction());
  const controller = useRef(new GestureController());
  const manualUntil = useRef(0);
  const lastStatus = useRef(0);
  const [settings, setSettings] = useState<SceneSettings>(DEFAULTS);
  const [stats, setStats] = useState<SceneStats>({ fps: 0, count: 20000, quality: 'HIGH' });
  const [gesture, setGesture] = useState<GestureStatus>({ kind: 'idle', hands: 0, confidence: 0 });
  const [guide, setGuide] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mobileControls, setMobileControls] = useState(false);
  const [toast, setToast] = useState('');
  const [manualAction, setManualAction] = useState('');
  const [vortex, setVortex] = useState(false);
  const update = useCallback((patch: Partial<SceneSettings>) => setSettings(s => ({ ...s, ...patch })), []);
  const camera = useHandTracking((frame, time) => {
    if (time >= manualUntil.current && vortex) setVortex(false);
    const currentInput = time < manualUntil.current ? { ...interaction.current, attractor: { ...interaction.current.attractor } } : interaction.current;
    const status = controller.current.process(frame, time, currentInput, () => update({ shape: 'heart' }));
    if (time - lastStatus.current > 100) { setGesture(status); lastStatus.current = time; }
  }, () => {
    controller.current.reset(interaction.current);
    setVortex(false);
    setGesture({ kind: 'idle', hands: 0, confidence: 0 });
    update({ mouse: true });
  });
  const changeSettings = (patch: Partial<SceneSettings>) => {
    if (patch.mouse === true && camera.phase !== 'off') camera.stop();
    update(patch);
  };
  const startCamera = () => { void camera.start(); update({ mouse: false }); setVortex(false); };
  const reset = useCallback(() => {
    controller.current.reset(interaction.current); manualUntil.current = 0;
    setVortex(false); setManualAction('');
    setSettings(s => ({ ...DEFAULTS, mouse: camera.phase !== 'ready', resetKey: s.resetKey + 1 }));
    setToast('已回到宇宙的初始状态');
  }, [camera.phase]);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setToast('当前浏览器不支持全屏，可将页面添加到主屏幕');
    } catch { setToast('无法进入全屏，请使用浏览器的全屏功能'); }
  };
  const action = (kind: string) => {
    manualUntil.current = performance.now() + 2500;
    setManualAction(kind);
    if (kind === 'expand') interaction.current.spread = 1.25;
    if (kind === 'contract') interaction.current.spread = -1.1;
    if (kind === 'zoom-in') interaction.current.scale = Math.min(1.85, interaction.current.scale + 0.15);
    if (kind === 'zoom-out') interaction.current.scale = Math.max(0.5, interaction.current.scale - 0.15);
    if (kind === 'vortex') {
      const enabled = !vortex; setVortex(enabled);
      interaction.current.active = enabled;
      interaction.current.attractor = { x: 0, y: 0, strength: enabled ? 1.7 : 0 };
    }
    if (kind === 'heart') update({ shape: 'heart' });
  };
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3200); return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!manualAction) return;
    const id = setTimeout(() => setManualAction(''), 2200); return () => clearTimeout(id);
  }, [manualAction]);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setGuide(false); setMobileControls(false); }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (e.key.toLowerCase() === 'r') reset();
      if (e.key.toLowerCase() === 'h') setGuide(g => !g);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [reset]);
  useEffect(() => {
    if (!guide) return;
    const previous = document.activeElement as HTMLElement;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const buttons = document.querySelector('.guide-modal')?.querySelectorAll<HTMLElement>('button, a, input, [tabindex="0"]');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trap);
    return () => { window.removeEventListener('keydown', trap); previous?.focus(); };
  }, [guide]);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('.intro-copy, .workspace-sidebar, .bottom-ui, .site-header', { opacity: 0, y: 12, duration: 0.9, stagger: 0.12, ease: 'power2.out', clearProps: 'all' });
    }, root);
    return () => ctx.revert();
  }, []);
  const currentShape = SHAPES.find(s => s.id === settings.shape)!;
  return <main ref={root} className={`universe ${settings.mouse ? 'mouse-mode' : ''}`}>
    <ParticleScene settings={settings} interaction={interaction} onStats={setStats} />
    <div className="scene-vignette" aria-hidden="true" />
    <header className="site-header">
      <a className="brand" href="#" aria-label="Gesture Particle Universe 首页"><span className="brand-mark"><Orbit size={25} strokeWidth={1.25} /></span><span>GESTURE<span className="brand-light"> / </span>UNIVERSE<small>AN INTERACTIVE PARTICLE EXPERIENCE</small></span></a>
      <div className="header-actions"><span className="local-badge"><i />本地实时渲染</span><button className="icon-button" onClick={() => setGuide(true)} aria-label="打开手势指南" title="手势指南 (H)"><CircleHelp size={18} /></button><span className="header-divider" /><button className="icon-button" onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏' : '进入全屏'} title="全屏">{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button></div>
    </header>
    <div className="intro-copy"><div className="eyebrow"><span /> THE UNIVERSE AT YOUR FINGERTIPS</div><h1>让想象，<br />在指尖<span>成形。</span></h1><p>无需触碰，即可改变。<br />用一个手势，唤醒属于你的粒子宇宙。</p><button className="intro-link" onClick={() => setGuide(true)}>探索交互方式 <ArrowUpRight size={15} /></button><div className="intro-coordinate">EST. 2026 <span>✧</span> INFINITE POSSIBILITIES</div></div>
    <div className="scene-caption"><span className="caption-line" /><span>0{SHAPES.findIndex(s => s.id === settings.shape) + 1} / 06</span><b>{currentShape.english}</b><small>每一颗粒子，皆有引力</small></div>
    <button className="mobile-settings-button glass" onClick={() => setMobileControls(!mobileControls)} aria-label={mobileControls ? '收起控制面板' : '打开控制面板'} aria-expanded={mobileControls}>{mobileControls ? <X size={19} /> : <SlidersHorizontal size={19} />}</button>
    <aside className={`workspace-sidebar ${mobileControls ? 'is-open' : ''}`}>
      <CameraPanel {...camera} gesture={gesture} onStart={startCamera} onStop={camera.stop} />
      <ControlPanel settings={settings} actualCount={stats.count} onChange={changeSettings} />
      <button className="reset-button" onClick={reset}><RotateCcw size={13} />重置宇宙<span>R</span></button>
    </aside>
    <div className="bottom-ui">
      <div className="interaction-toolbar glass" aria-label="手动粒子交互"><span className="toolbar-label">引力控制</span><button className={`tool-button ${manualAction === 'expand' ? 'active' : ''}`} onClick={() => action('expand')} title="粒子扩散" aria-label="粒子扩散"><Expand size={17} /></button><button className={`tool-button ${manualAction === 'contract' ? 'active' : ''}`} onClick={() => action('contract')} title="粒子收缩" aria-label="粒子收缩"><Shrink size={17} /></button><span className="toolbar-divider" /><button className="tool-button" onClick={() => action('zoom-out')} title="缩小粒子" aria-label="缩小粒子"><Minus size={17} /></button><button className="tool-button" onClick={() => action('zoom-in')} title="放大粒子" aria-label="放大粒子"><Plus size={17} /></button><span className="toolbar-divider" /><button className={`tool-button ${vortex ? 'active' : ''}`} onClick={() => action('vortex')} title="中心引力漩涡" aria-label="中心引力漩涡" aria-pressed={vortex}><Magnet size={17} /></button><button className={`tool-button ${settings.shape === 'heart' ? 'active' : ''}`} onClick={() => action('heart')} title="切换爱心" aria-label="切换爱心"><Heart size={17} /></button></div>
      <div className="mouse-hint">{settings.mouse ? <><MousePointer2 size={12} /><span>移动鼠标旋转 <i>·</i> 按住吸引 <i>·</i> 滚轮缩放</span></> : <><Hand size={13} /><span>{camera.phase === 'ready' ? '抬起双手，让宇宙跟随你的动作' : '正在准备你的手势空间'}</span></>}</div>
      <section className="gesture-strip" aria-label="手势速查"><div className="strip-title">以手势<br /><span>探索无限</span></div>{GUIDES.map(({ icon: Icon, name, action: label }, i) => <button key={name} className="gesture-tip" onClick={() => i === 0 ? action('expand') : i === 1 ? action('contract') : i === 3 ? action('zoom-in') : i === 4 ? action('vortex') : i === 5 ? action('heart') : update({ rotation: !settings.rotation })} title={i === 2 ? '切换自动旋转' : label}><Icon size={23} strokeWidth={1.2} /><span>{name}<small>{label}</small></span></button>)}</section>
      <footer className="site-footer"><div className="performance-stats"><span className="fps-indicator" /><span><b data-testid="fps">{stats.fps || '—'}</b> FPS</span><span className="footer-separator" /><span><b data-testid="particle-count">{stats.count.toLocaleString('en-US')}</b> 粒子</span><span className="render-badge">WEBGL 2.0</span><span className="quality-label">{stats.quality === 'HIGH' ? '高画质' : stats.quality === 'BALANCED' ? '均衡画质' : '流畅模式'}</span></div><span className="footer-tagline">BUILT FOR CURIOSITY. <span>MADE OF PARTICLES.</span></span></footer>
    </div>
    {guide && <GestureGuide onClose={() => setGuide(false)} />}
    {toast && <div className="toast glass" role="status">{toast}</div>}
  </main>;
}
