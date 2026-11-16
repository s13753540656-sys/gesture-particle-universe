import type { Shape } from '../types';

export function seededRandom(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Deterministic, prefix-safe distributions: any drawRange keeps a complete shape. */
export function generateShape(shape: Shape, count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const random = seededRandom(417);
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-8, random()))) * Math.cos(2 * Math.PI * random());
  for (let i = 0; i < count; i++) {
    const t = random() * Math.PI * 2;
    let x = 0, y = 0, z = 0;
    switch (shape) {
      case 'sphere': {
        const h = random() * 2 - 1;
        const radius = 2.25 * (random() < 0.85 ? 0.93 + random() * 0.07 : Math.cbrt(random()));
        const phi = t + h * 2.6;
        const cross = Math.sqrt(1 - h * h);
        const ripple = 1 + Math.sin(h * 24 + phi * 3) * 0.025;
        x = Math.cos(phi) * cross * radius * ripple;
        y = h * radius; z = Math.sin(phi) * cross * radius * ripple;
        break;
      }
      case 'nebula': {
        const radius = Math.pow(random(), 0.65) * 2.8;
        const angle = t + radius * 0.8;
        const cloud = 0.12 + radius * 0.13;
        x = Math.cos(angle) * radius + gaussian() * cloud;
        y = Math.sin(angle) * radius * 0.62 + Math.sin(radius * 3 + angle) * 0.3 + gaussian() * cloud * 0.5;
        z = Math.sin(angle * 3) * radius * 0.3 + gaussian() * cloud * 1.2;
        break;
      }
      case 'heart': {
        const radius = Math.pow(random(), 0.24);
        x = 16 * Math.pow(Math.sin(t), 3) * 0.145 * radius;
        y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.145 * radius + 0.3;
        z = gaussian() * 0.27 * Math.sqrt(Math.max(0.05, 1 - radius * radius));
        break;
      }
      case 'spiral': {
        const arm = Math.floor(random() * 5);
        const radius = Math.pow(random(), 0.65) * 3;
        const angle = arm / 5 * Math.PI * 2 + radius * 1.55 + gaussian() * 0.18;
        const px = Math.cos(angle) * radius, pz = Math.sin(angle) * radius;
        const py = gaussian() * (0.035 + 0.12 * (1 - radius / 3));
        x = px; y = py * 0.57 - pz * 0.82; z = py * 0.82 + pz * 0.57;
        break;
      }
      case 'infinity': {
        const denominator = 1 + Math.pow(Math.cos(t), 2);
        const tube = random() * Math.PI * 2;
        const thickness = Math.sqrt(random()) * 0.24;
        x = 3.2 * Math.sin(t) / denominator + Math.cos(tube) * thickness;
        y = 3.2 * Math.sin(t) * Math.cos(t) / denominator + Math.sin(tube) * thickness;
        z = Math.cos(t) * 0.46 + gaussian() * 0.12;
        break;
      }
      case 'explosion': {
        // Correlated directions create radial supernova rays, rather than another sphere.
        const ray = Math.floor(random() * 180);
        const ry = 1 - 2 * ((ray + 0.5) / 180);
        const angle = ray * Math.PI * (3 - Math.sqrt(5));
        const radius = Math.pow(random(), 0.48) * 3.6;
        const cross = Math.sqrt(1 - ry * ry);
        const jitter = 0.025 * radius;
        x = Math.cos(angle) * cross * radius + gaussian() * jitter;
        y = ry * radius + gaussian() * jitter;
        z = Math.sin(angle) * cross * radius + gaussian() * jitter;
        break;
      }
    }
    positions.set([x, y, z], i * 3);
  }
  return positions;
}
