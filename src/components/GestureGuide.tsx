import { Hand, Grab, MoveHorizontal, Expand, Pointer, Heart, X } from 'lucide-react';

export const GUIDES = [
  { icon: Hand, name: '张开手掌', action: '粒子扩散', detail: '将手掌朝向摄像头，展开五指，让粒子向外舒展。' },
  { icon: Grab, name: '轻轻握拳', action: '粒子收缩', detail: '将四指收拢为拳头，让粒子向中心汇聚。' },
  { icon: MoveHorizontal, name: '左右移动', action: '旋转宇宙', detail: '保持手部可见，缓慢左右移动手掌以旋转粒子。' },
  { icon: Expand, name: '双手开合', action: '缩放粒子', detail: '同时展示双手，拉开双手放大，靠近双手缩小。' },
  { icon: Pointer, name: '食指指向', action: '引力漩涡', detail: '伸出食指、收起其他三指，指尖附近会产生局部漩涡。' },
  { icon: Heart, name: '双手比心', action: '切换爱心', detail: '两手食指尖在上、拇指尖在下靠拢，保持约半秒。也可直接点击爱心按钮。' },
];
export function GestureGuide({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><section className="guide-modal glass" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e => e.stopPropagation()}>
    <button className="icon-button modal-close" onClick={onClose} aria-label="关闭手势指南" autoFocus><X size={18} /></button>
    <span className="eyebrow">A LITTLE GUIDE TO YOUR UNIVERSE</span><h2 id="guide-title">一双手，无限可能。</h2><p>开启摄像头，在明亮环境下，让手部完整出现在预览画面中。</p>
    <div className="guide-list">{GUIDES.map(({ icon: Icon, name, action, detail }) => <article key={name}><Icon size={24} strokeWidth={1.3} /><div><h3>{name}<span>{action}</span></h3><p>{detail}</p></div></article>)}</div>
    <div className="guide-footnote">鼠标模式：移动旋转 · 按住吸引 · 滚轮缩放<br />触屏模式：滑动旋转 · 按住吸引 · 使用下方按钮缩放</div>
  </section></div>;
}
