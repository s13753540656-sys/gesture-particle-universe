import { useCallback, useEffect, useRef, useState } from 'react';
import { HandTracker } from '../vision/HandTracker';
import type { HandFrame } from '../vision/protocol';

export type CameraPhase = 'off' | 'requesting' | 'loading' | 'ready' | 'error';
export function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '摄像头权限被拒绝。请在浏览器地址栏允许摄像头访问，然后重试。';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '未找到摄像头，请连接摄像头后重试。';
  if (name === 'NotReadableError' || name === 'TrackStartError') return '摄像头正被其他应用占用，请关闭占用程序后重试。';
  return '摄像头或识别模型初始化失败。请确认摄像头可用、模型文件完整，然后重试。';
}

export function useHandTracking(onFrame: (frame: HandFrame, time: number) => void, onStop: () => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarksRef = useRef<HandFrame>({ landmarks: [], handedness: [] });
  const stream = useRef<MediaStream | null>(null);
  const tracker = useRef<HandTracker | null>(null);
  const raf = useRef(0), generation = useRef(0);
  const callbacks = useRef({ onFrame, onStop }); callbacks.current = { onFrame, onStop };
  const [phase, setPhase] = useState<CameraPhase>('off');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('');
  const cleanup = useCallback(() => {
    generation.current++; cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    stream.current = null;
    tracker.current?.close(); tracker.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    landmarksRef.current = { landmarks: [], handedness: [] };
  }, []);
  const stop = useCallback(() => { cleanup(); setPhase('off'); setError(''); callbacks.current.onStop(); }, [cleanup]);
  const start = useCallback(async () => {
    cleanup(); callbacks.current.onStop(); setError(''); setPhase('requesting');
    const token = generation.current;
    let acquired: MediaStream | null = null;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('需要通过 localhost 或 HTTPS 访问才能使用摄像头。');
      acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } }, audio: false });
      if (token !== generation.current) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream.current = acquired;
      acquired.getVideoTracks().forEach(track => { track.onended = () => {
        cleanup(); callbacks.current.onStop(); setPhase('error'); setError('摄像头连接已中断，请重新开启。');
      }; });
      const video = videoRef.current!;
      video.srcObject = acquired;
      await video.play();
      if (token !== generation.current) return;
      setPhase('loading');
      const instance = new HandTracker(); tracker.current = instance;
      await instance.initialize();
      if (token !== generation.current) { instance.close(); return; }
      setMode(instance.mode); setPhase('ready');
      let lastTime = 0, lastVideo = -1;
      const loop = async (now: number) => {
        if (token !== generation.current) return;
        if (!document.hidden && video.readyState >= 2 && video.currentTime !== lastVideo && now - lastTime > (instance.mode.startsWith('Worker') ? 45 : 75)) {
          lastTime = now; lastVideo = video.currentTime;
          try {
            const result = await instance.detect(video, now);
            if (result && token === generation.current) { landmarksRef.current = result; callbacks.current.onFrame(result, now); }
          } catch (cause) {
            if (token === generation.current) {
              cleanup(); callbacks.current.onStop(); setPhase('error'); setError(cause instanceof Error ? `识别中断：${cause.message}` : '识别中断，请重试。');
            }
            return;
          }
        }
        if (token === generation.current) raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    } catch (cause) {
      acquired?.getTracks().forEach(t => t.stop());
      if (token !== generation.current) return;
      cleanup(); callbacks.current.onStop(); setPhase('error');
      setError(!window.isSecureContext ? '需要通过 localhost 或 HTTPS 访问才能使用摄像头。' : cameraErrorMessage(cause));
    }
  }, [cleanup]);
  useEffect(() => {
    // Stop capture before a page enters Safari's back-forward cache, too.
    const pageHide = () => stop();
    window.addEventListener('pagehide', pageHide);
    return () => { window.removeEventListener('pagehide', pageHide); cleanup(); };
  }, [cleanup, stop]);
  return { videoRef, landmarksRef, phase, error, mode, start, stop };
}
