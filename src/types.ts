export type Shape = 'sphere' | 'nebula' | 'heart' | 'spiral' | 'infinity' | 'explosion';
export type Palette = 'cosmic' | 'ocean' | 'aurora' | 'sunset';
export interface Interaction {
  active: boolean;
  spread: number;
  scale: number;
  rotation: number;
  attractor: { x: number; y: number; strength: number };
}
export const createInteraction = (): Interaction => ({
  active: false, spread: 0, scale: 1, rotation: 0, attractor: { x: 0, y: 0, strength: 0 },
});
export interface SceneSettings {
  shape: Shape; palette: Palette; count: number; autoCount: boolean;
  bloom: boolean; trails: boolean; rotation: boolean; mouse: boolean;
  speed: number; pointSize: number; resetKey: number;
}
export interface SceneStats { fps: number; count: number; quality: string; }
