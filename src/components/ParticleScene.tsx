import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ParticleEngine } from '../graphics/ParticleEngine';
import type { Interaction, SceneSettings, SceneStats } from '../types';

export function ParticleScene({ settings, interaction, onStats }: {
  settings: SceneSettings; interaction: MutableRefObject<Interaction>; onStats: (s: SceneStats) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<ParticleEngine | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const target = container.current!;
    const reportError = (event: Event) => setError((event as CustomEvent<string>).detail);
    target.addEventListener('scene-error', reportError);
    try { engine.current = new ParticleEngine(container.current!, settings, interaction.current, onStats); }
    catch { setError('无法创建 WebGL 场景，请开启浏览器硬件加速并刷新页面。'); }
    return () => { target.removeEventListener('scene-error', reportError); engine.current?.dispose(); engine.current = null; };
    // Engine lifetime is independent of settings, which update in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { engine.current?.update(settings); }, [settings]);
  return <div ref={container} className="particle-scene" aria-label="交互式三维粒子宇宙">{error && <div className="scene-error" role="alert">{error}</div>}</div>;
}
