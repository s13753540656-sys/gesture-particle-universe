export interface Landmark { x: number; y: number; z: number; }
export interface HandFrame {
  landmarks: Landmark[][];
  handedness: { categoryName: string; score: number }[][];
}
export type WorkerRequest = { type: 'init'; base: string } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };
export type WorkerReply = { type: 'ready'; delegate: string } | { type: 'result'; result: HandFrame } | { type: 'error'; message: string };
