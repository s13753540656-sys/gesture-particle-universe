import { Circle, Orbit, Heart, Sparkles, Infinity as InfinityIcon, Zap, SlidersHorizontal, RotateCw, MousePointer2, Waves } from 'lucide-react';
import type { Palette, SceneSettings, Shape } from '../types';

export const SHAPES: { id: Shape; name: string; english: string; icon: typeof Circle }[] = [
  { id: 'sphere', name: '三维球体', english: 'SPHERE', icon: Circle },
  { id: 'nebula', name: '银河星云', english: 'NEBULA', icon: Sparkles },
  { id: 'heart', name: '浪漫爱心', english: 'HEART', icon: Heart },
  { id: 'spiral', name: '螺旋星系', english: 'GALAXY', icon: Orbit },
  { id: 'infinity', name: '无限符号', english: 'INFINITY', icon: InfinityIcon },
  { id: 'explosion', name: '粒子爆炸', english: 'SUPERNOVA', icon: Zap },
];
const COLORS: { id: Palette; name: string; gradient: string }[] = [
  { id: 'cosmic', name: '宇宙紫', gradient: 'linear-gradient(135deg,#6871ff,#c17cff)' },
  { id: 'ocean', name: '深海蓝', gradient: 'linear-gradient(135deg,#4669ef,#6ce9fa)' },
  { id: 'aurora', name: '极光绿', gradient: 'linear-gradient(135deg,#42aab0,#9aefc9)' },
  { id: 'sunset', name: '落日粉', gradient: 'linear-gradient(135deg,#ef87be,#ffd5a1)' },
];
export function ControlPanel({ settings, actualCount, onChange }: {
  settings: SceneSettings; actualCount: number; onChange: (patch: Partial<SceneSettings>) => void;
}) {
  return <section className="control-panel glass" aria-label="粒子控制">
    <div className="panel-heading"><span><SlidersHorizontal size={15} /> 粒子控制</span><small>PLAYGROUND</small></div>
    <div className="control-section"><div className="field-label"><span>粒子形态</span><small>SHAPE</small></div>
      <div className="shape-grid">{SHAPES.map(({ id, name, icon: Icon }) => <button key={id} className={`shape-button ${settings.shape === id ? 'selected' : ''}`} onClick={() => onChange({ shape: id })} aria-pressed={settings.shape === id}><Icon size={22} strokeWidth={1.3} /><span>{name}</span></button>)}</div>
    </div>
    <div className="control-section"><div className="field-label"><span>粒子色彩</span><small>{COLORS.find(c => c.id === settings.palette)?.name}</small></div>
      <div className="palette-row">{COLORS.map(color => <button key={color.id} className={`palette-button ${settings.palette === color.id ? 'selected' : ''}`} style={{ background: color.gradient }} onClick={() => onChange({ palette: color.id })} aria-label={color.name} aria-pressed={settings.palette === color.id} title={color.name}>{settings.palette === color.id && <span />}</button>)}<span className="palette-caption">让宇宙，有你的色彩</span></div>
    </div>
    <div className="control-section"><div className="field-label"><label htmlFor="particle-count">粒子数量</label><button className={`auto-chip ${settings.autoCount ? 'on' : ''}`} onClick={() => onChange({ autoCount: !settings.autoCount })} aria-pressed={settings.autoCount}>{settings.autoCount ? '自动适配' : '手动'}</button></div>
      <div className="count-value">{(settings.autoCount ? actualCount : settings.count).toLocaleString('en-US')}<small>particles</small></div>
      <input id="particle-count" type="range" min="5000" max="40000" step="1000" value={settings.autoCount ? actualCount : settings.count} style={{ '--range-progress': `${((settings.autoCount ? actualCount : settings.count) - 5000) / 350}%` } as React.CSSProperties} onChange={e => onChange({ count: Number(e.target.value), autoCount: false })} />
      <div className="range-labels"><span>5,000</span><span>40,000</span></div>
    </div>
    <div className="toggle-grid">
      <Toggle label="辉光效果" icon={Sparkles} value={settings.bloom} onChange={() => onChange({ bloom: !settings.bloom })} />
      <Toggle label="粒子拖尾" icon={Waves} value={settings.trails} onChange={() => onChange({ trails: !settings.trails })} />
      <Toggle label="自动旋转" icon={RotateCw} value={settings.rotation} onChange={() => onChange({ rotation: !settings.rotation })} />
      <Toggle label="鼠标交互" icon={MousePointer2} value={settings.mouse} onChange={() => onChange({ mouse: !settings.mouse })} />
    </div>
  </section>;
}
function Toggle({ label, icon: Icon, value, onChange }: { label: string; icon: typeof Circle; value: boolean; onChange: () => void }) {
  return <button className="toggle-row" role="switch" aria-checked={value} onClick={onChange}><span><Icon size={13} />{label}</span><i className={`switch ${value ? 'on' : ''}`} /></button>;
}
