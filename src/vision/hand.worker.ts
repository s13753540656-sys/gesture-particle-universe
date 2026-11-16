import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { WorkerRequest, WorkerReply } from './protocol';

let landmarker: HandLandmarker | null = null;
const reply = (message: WorkerReply) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  if (data.type === 'init') {
    try {
      const fileset = await FilesetResolver.forVisionTasks(`${data.base}mediapipe/wasm`);
      const options = {
        baseOptions: { modelAssetPath: `${data.base}mediapipe/hand_landmarker.task` },
        runningMode: 'VIDEO' as const, numHands: 2,
        minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
      };
      let delegate = 'GPU';
      try { landmarker = await HandLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } }); }
      catch { delegate = 'CPU'; landmarker = await HandLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } }); }
      reply({ type: 'ready', delegate });
    } catch (error) { reply({ type: 'error', message: error instanceof Error ? error.message : '模型加载失败' }); }
  } else {
    try {
      if (!landmarker) throw new Error('识别器尚未就绪');
      const result = landmarker.detectForVideo(data.bitmap, data.timestamp);
      reply({ type: 'result', result: { landmarks: result.landmarks, handedness: result.handedness } });
    } catch (error) { reply({ type: 'error', message: error instanceof Error ? error.message : '推理失败' }); }
    finally { data.bitmap.close(); }
  }
};
