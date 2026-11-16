import { useEffect, useRef, type RefObject, type MutableRefObject } from 'react';
import { Camera, CameraOff, LoaderCircle, ScanLine } from 'lucide-react';
import type { CameraPhase } from '../hooks/useHandTracking';
import type { HandFrame } from '../vision/protocol';
import type { GestureStatus } from '../vision/gestures';

export const GESTURE_LABELS = { idle: '等待手势', tracking: '已检测到手部', open: '张开手掌 · 粒子扩散', fist: '握拳 · 粒子收缩', point: '食指指向 · 引力漩涡', zoom: '双手移动 · 粒子缩放', heart: '双手比心 · 爱心形态' };
const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>; landmarksRef: MutableRefObject<HandFrame>;
  phase: CameraPhase; error: string; mode: string; gesture: GestureStatus;
  onStart: () => void; onStop: () => void;
}
export function CameraPanel({ videoRef, landmarksRef, phase, error, mode, gesture, onStart, onStop }: CameraPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pending = phase === 'loading' || phase === 'requesting';
  const active = phase === 'ready';
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!;
    const draw = () => {
      const video = videoRef.current;
      if (video?.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const hand of landmarksRef.current.landmarks) {
        ctx.strokeStyle = '#9a8cff'; ctx.lineWidth = 2;
        ctx.beginPath();
        CONNECTIONS.forEach(([a, b]) => { ctx.moveTo(hand[a].x * canvas.width, hand[a].y * canvas.height); ctx.lineTo(hand[b].x * canvas.width, hand[b].y * canvas.height); });
        ctx.stroke(); ctx.fillStyle = '#8ef0e1';
        hand.forEach(p => { ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2); ctx.fill(); });
      }
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [active, landmarksRef, videoRef]);
  return <section className="camera-panel glass" aria-label="手势识别">
    <div className="panel-heading"><span><ScanLine size={15} /> 手势识别</span><span className={`status-pill ${active ? 'live' : ''}`}><i />{active ? '运行中' : pending ? '连接中' : '未连接'}</span></div>
    <div className={`camera-preview ${active ? 'is-live' : ''}`}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="摄像头实时预览" />
      <canvas ref={canvasRef} width="640" height="480" aria-hidden="true" />
      {!active && <div className="camera-placeholder">{pending ? <LoaderCircle size={25} className="spin" /> : <CameraOff size={25} strokeWidth={1.3} />}<span>{phase === 'requesting' ? '请允许摄像头访问' : phase === 'loading' ? '正在加载手部识别模型' : '用双手，连接你的宇宙'}</span><small>{pending ? '首次启动可能需要片刻' : '开启摄像头，体验实时手势交互'}</small></div>}
      <span className="view-corner tl" /><span className="view-corner tr" /><span className="view-corner bl" /><span className="view-corner br" />
      {active && <span className="camera-live-label"><i /> LIVE <b>{gesture.hands} HAND{gesture.hands === 1 ? '' : 'S'}</b></span>}
    </div>
    <div className="recognition-line" role="status"><span className={`recognition-dot ${gesture.hands ? 'detected' : ''}`} /><span>{active ? GESTURE_LABELS[gesture.kind] : '摄像头已关闭'}</span>{active && gesture.hands > 0 && <small>已追踪</small>}</div>
    <button className={`camera-button ${active ? 'connected' : ''}`} onClick={active || pending ? onStop : onStart}>
      {pending ? <LoaderCircle className="spin" size={16} /> : active ? <CameraOff size={16} /> : <Camera size={16} />}
      {pending ? '取消连接' : active ? '关闭摄像头' : phase === 'error' ? '重新连接摄像头' : '开启摄像头'}
    </button>
    {error && <p className="camera-error" role="alert">{error}</p>}
    <p className="privacy-note">{active ? `${mode} · 视频仅在本机处理` : '视频仅在本机处理，不会上传或保存'}</p>
  </section>;
}
