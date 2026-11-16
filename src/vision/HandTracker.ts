import type { HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandFrame, WorkerReply } from './protocol';

/** One frame in flight; dropped camera frames never queue behind inference. */
export class HandTracker {
  private worker: Worker | null = null;
  private main: HandLandmarker | null = null;
  private busy = false;
  private closed = false;
  private pending: ((frame: HandFrame) => void) | null = null;
  private rejectPending: ((reason: Error) => void) | null = null;
  private rejectInit: ((reason: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  mode = '';

  async initialize() {
    const base = new URL(import.meta.env.BASE_URL, location.href).href;
    if (typeof Worker !== 'undefined' && typeof createImageBitmap !== 'undefined') {
      try {
        await new Promise<void>((resolve, reject) => {
          this.rejectInit = reject;
          this.worker = new Worker(`${base}mediapipe/hand.worker.js`);
          this.timer = setTimeout(() => reject(new Error('Worker 初始化超时')), 25000);
          this.worker.onerror = event => { event.preventDefault(); reject(new Error(event.message)); };
          this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
            if (event.data.type === 'ready') { this.mode = `Worker · ${event.data.delegate}`; resolve(); }
            else if (event.data.type === 'error') reject(new Error(event.data.message));
          };
          this.worker.postMessage({ type: 'init', base });
        });
        clearTimeout(this.timer);
        this.rejectInit = null;
        if (this.closed) { this.worker?.terminate(); return; }
        this.worker!.onerror = event => this.fail(new Error(event.message || '识别线程已停止'));
        this.worker!.onmessage = (event: MessageEvent<WorkerReply>) => {
          clearTimeout(this.timer);
          this.busy = false;
          if (event.data.type === 'result') { this.pending?.(event.data.result); this.pending = null; this.rejectPending = null; }
          else if (event.data.type === 'error') this.fail(new Error(event.data.message));
        };
        return;
      } catch {
        this.rejectInit = null;
        clearTimeout(this.timer); this.worker?.terminate(); this.worker = null;
      }
    }
    if (this.closed) return;
    // Safari and Worker/WebGL incompatibilities fall back to throttled main-thread inference.
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    const options = {
      baseOptions: { modelAssetPath: `${base}mediapipe/hand_landmarker.task` },
      runningMode: 'VIDEO' as const, numHands: 2,
      minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
    };
    let delegate = 'GPU';
    try { this.main = await HandLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } }); }
    catch { delegate = 'CPU'; this.main = await HandLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } }); }
    this.mode = `兼容模式 · ${delegate}`;
    if (this.closed) { this.main.close(); this.main = null; }
  }

  async detect(video: HTMLVideoElement, timestamp: number): Promise<HandFrame | null> {
    if (this.busy || this.closed) return null;
    this.busy = true;
    if (this.worker) {
      try {
        const bitmap = await createImageBitmap(video);
        if (this.closed) { bitmap.close(); this.busy = false; return null; }
        return await new Promise<HandFrame>((resolve, reject) => {
          this.pending = resolve; this.rejectPending = reject;
          this.timer = setTimeout(() => this.fail(new Error('手势识别响应超时，请重试')), 12000);
          this.worker!.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
        });
      } catch (error) { this.busy = false; throw error; }
    }
    try {
      if (!this.main) return null;
      const result = this.main.detectForVideo(video, timestamp);
      return { landmarks: result.landmarks, handedness: result.handedness };
    } finally { this.busy = false; }
  }
  private fail(error: Error) {
    clearTimeout(this.timer); this.busy = false;
    this.rejectPending?.(error); this.pending = null; this.rejectPending = null;
  }
  close() {
    this.closed = true; this.rejectInit?.(new Error('识别已停止')); this.rejectInit = null;
    this.fail(new Error('识别已停止'));
    this.worker?.terminate(); this.worker = null;
    this.main?.close(); this.main = null;
  }
}
