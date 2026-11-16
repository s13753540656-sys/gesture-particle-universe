import { createInteraction, type Interaction } from '../types';
import type { HandFrame, Landmark } from './protocol';

export type GestureKind = 'idle' | 'tracking' | 'open' | 'fist' | 'point' | 'zoom' | 'heart';
export interface GestureStatus { kind: GestureKind; hands: number; confidence: number; }
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.6);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function fingerExtended(hand: Landmark[], mcp: number, pip: number, tip: number) {
  const a = hand[mcp], b = hand[pip], c = hand[tip];
  const ab = [a.x - b.x, a.y - b.y, a.z - b.z], cb = [c.x - b.x, c.y - b.y, c.z - b.z];
  const cosine = (ab[0] * cb[0] + ab[1] * cb[1] + ab[2] * cb[2]) / (Math.hypot(...ab) * Math.hypot(...cb) + 1e-8);
  return cosine < -0.6 && distance(c, hand[0]) > distance(b, hand[0]) * 1.15;
}
export function classifyHand(hand: Landmark[]): GestureKind {
  const extended = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]].map(([a, b, c]) => fingerExtended(hand, a, b, c));
  const count = extended.filter(Boolean).length;
  if (count === 4) return 'open';
  if (extended[0] && count === 1) return 'point';
  const folded = [8, 12, 16, 20].filter((tip, i) => distance(hand[tip], hand[0]) < distance(hand[[6, 10, 14, 18][i]], hand[0]) * 1.12).length;
  return count === 0 && folded >= 3 ? 'fist' : 'tracking';
}

/** Both index tips and both thumb tips meet; thumbs sit beneath index tips. */
export function isTwoHandHeart(a: Landmark[], b: Landmark[]) {
  const palm = (distance(a[5], a[17]) + distance(b[5], b[17])) / 2;
  if (palm < 0.025) return false;
  const indexY = (a[8].y + b[8].y) / 2, thumbY = (a[4].y + b[4].y) / 2;
  return distance(a[8], b[8]) < palm * 0.65 && distance(a[4], b[4]) < palm * 0.7
    && thumbY - indexY > palm * 0.3 && thumbY - indexY < palm * 2.6
    && Math.abs((a[8].x + b[8].x - a[4].x - b[4].x) / 2) < palm * 0.8
    && distance(a[9], b[9]) > palm * 0.9
    && a[0].y > indexY && b[0].y > indexY;
}

export class GestureController {
  private candidate: GestureKind = 'idle';
  private stable: GestureKind = 'idle';
  private candidateSince = 0;
  private lastSeen = -Infinity;
  private lastTime = 0;
  private zoomBaseline = 0;
  private zoomScale = 1;
  private heartLatched = false;
  private lastHeart = -Infinity;
  reset(input: Interaction) {
    Object.assign(input, createInteraction());
    this.candidate = this.stable = 'idle'; this.zoomBaseline = 0;
    this.heartLatched = false; this.lastSeen = -Infinity; this.lastTime = 0;
  }
  process(frame: HandFrame, now: number, input: Interaction, onHeart: () => void): GestureStatus {
    const hands = frame.landmarks.filter((hand, i) => hand.length === 21
      && (frame.handedness[i]?.[0]?.score ?? 0) >= 0.6
      && hand.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)));
    if (!hands.length) {
      if (now - this.lastSeen > 220) this.reset(input);
      return { kind: input.active ? this.stable : 'idle', hands: 0, confidence: 0 };
    }
    const dt = this.lastTime ? clamp((now - this.lastTime) / 1000, 0.001, 0.15) : 0.05;
    const smoothing = 1 - Math.exp(-dt * 9);
    this.lastTime = now; this.lastSeen = now;
    const heart = hands.length === 2 && isTwoHandHeart(hands[0], hands[1]);
    const next = heart ? 'heart' : hands.length === 2 ? 'zoom' : classifyHand(hands[0]);
    if (next !== this.candidate) { this.candidate = next; this.candidateSince = now; }
    if (now - this.candidateSince >= (next === 'heart' ? 450 : 160)) this.stable = next;
    if (!heart) this.heartLatched = false;
    if (this.stable === 'heart' && heart && !this.heartLatched && now - this.lastHeart > 2000) {
      this.heartLatched = true; this.lastHeart = now; onHeart();
    }
    input.active = true;
    const spread = this.stable === 'open' ? 1.25 : this.stable === 'fist' ? -1.1 : 0;
    input.spread += (spread - input.spread) * smoothing;
    const center = hands.reduce((sum, h) => sum + (h[0].x + h[9].x) / 2, 0) / hands.length;
    input.rotation += ((0.5 - center) * 3.4 - input.rotation) * smoothing;
    if (hands.length === 2) {
      const separation = distance(hands[0][9], hands[1][9]);
      if (!this.zoomBaseline) { this.zoomBaseline = Math.max(0.08, separation); this.zoomScale = input.scale; }
      const scale = clamp(separation / this.zoomBaseline * this.zoomScale, 0.5, 1.85);
      input.scale += (scale - input.scale) * smoothing;
    } else this.zoomBaseline = 0;
    const tip = hands[0][8];
    input.attractor.x += ((1 - tip.x) * 2 - 1 - input.attractor.x) * smoothing;
    input.attractor.y += (1 - tip.y * 2 - input.attractor.y) * smoothing;
    input.attractor.strength += ((this.stable === 'point' ? 1.7 : 0) - input.attractor.strength) * smoothing;
    return { kind: this.stable === 'idle' ? 'tracking' : this.stable, hands: hands.length,
      confidence: Math.min(...frame.handedness.filter((_, i) => frame.landmarks[i]?.length === 21).map(h => h[0]?.score ?? 0)) };
  }
}
