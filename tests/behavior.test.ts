import test from 'node:test';
import assert from 'node:assert/strict';
import { generateShape } from '../src/graphics/shapes.ts';
import { GestureController, classifyHand, isTwoHandHeart } from '../src/vision/gestures.ts';
import { createInteraction } from '../src/types.ts';
import type { Shape } from '../src/types.ts';
import type { Landmark, HandFrame } from '../src/vision/protocol.ts';

const shapes: Shape[] = ['sphere','nebula','heart','spiral','infinity','explosion'];
for (const shape of shapes) test(`${shape}: finite, bounded and deterministic at any count`, () => {
  const small = generateShape(shape, 5000), large = generateShape(shape, 40000);
  assert.equal(small.length, 15000);
  assert.deepEqual(small, large.slice(0, 15000));
  assert.ok(large.every(v => Number.isFinite(v) && Math.abs(v) < 8));
});
test('all six distributions are distinct', () => {
  const fingerprints = shapes.map(shape => Array.from(generateShape(shape, 20)).join(','));
  assert.equal(new Set(fingerprints).size, 6);
});
function hand(kind: 'open' | 'fist' | 'point'): Landmark[] {
  const h = Array.from({length:21}, () => ({ x:0.5, y:0.7, z:0 }));
  h[0] = { x:0.5, y:0.9, z:0 };
  h[4] = { x:0.27, y:0.63, z:0 };
  for(let f=0; f<4; f++) {
    const mcp = [5,9,13,17][f], x = 0.38 + f * 0.09;
    const extended = kind === 'open' || kind === 'point' && f === 0;
    h[mcp] = { x, y:0.64, z:0 };
    h[mcp+1] = { x, y:0.46, z:0 };
    h[mcp+2] = { x, y:extended ? 0.35 : 0.57, z:0 };
    h[mcp+3] = { x, y:extended ? 0.24 : 0.72, z:0 };
  }
  return h;
}
const frame = (landmarks: Landmark[][], score=0.99): HandFrame => ({ landmarks, handedness: landmarks.map(() => [{categoryName:'Left',score}]) });
test('open palm, fist and pointing classification',()=>{
  for(const kind of ['open','fist','point'] as const) assert.equal(classifyHand(hand(kind)),kind);
});
test('gesture debounce suppresses brief detections; lost hand returns to neutral',()=>{
  const controller=new GestureController(), input=createInteraction();
  controller.process(frame([hand('open')]),0,input,()=>{});
  controller.process(frame([hand('open')]),100,input,()=>{});
  assert.equal(input.spread,0);
  controller.process(frame([hand('open')]),200,input,()=>{});
  assert.ok(input.spread>0);
  controller.process(frame([]),300,input,()=>{});
  assert.equal(input.active,true);
  controller.process(frame([]),500,input,()=>{});
  assert.deepEqual(input,createInteraction());
});
test('low confidence landmarks never control particles',()=>{
  const input=createInteraction(), controller=new GestureController();
  controller.process(frame([hand('fist')],0.3),0,input,()=>{});
  controller.process(frame([hand('fist')],0.3),1000,input,()=>{});
  assert.deepEqual(input,createInteraction());
});
test('two-hand scale is relative, smoothed and bounded',()=>{
  const controller=new GestureController(), input=createInteraction();
  const a=hand('open'), b=a.map(p=>({...p,x:p.x+0.3}));
  controller.process(frame([a,b]),0,input,()=>{});
  const farther=b.map(p=>({...p,x:p.x+0.4}));
  for(let t=100;t<=1000;t+=100)controller.process(frame([a,farther]),t,input,()=>{});
  assert.ok(input.scale>1.5 && input.scale<=1.85);
});
function heartPair(): Landmark[][] {
  const a=hand('fist'), b=a.map(p=>({...p,x:p.x+0.3}));
  a[8]={x:0.64,y:0.3,z:0};b[8]={x:0.66,y:0.3,z:0};
  a[4]={x:0.64,y:0.53,z:0};b[4]={x:0.66,y:0.53,z:0};
  return [a,b];
}
test('heart needs both tip pairs and dwell, fires once while held',()=>{
  const [a,b]=heartPair();assert.equal(isTwoHandHeart(a,b),true);
  const controller=new GestureController(),input=createInteraction();let fired=0;
  for(let t=0;t<=1500;t+=100)controller.process(frame([a,b]),t,input,()=>fired++);
  assert.equal(fired,1);
  assert.equal(isTwoHandHeart(hand('open'),hand('open').map(p=>({...p,x:p.x+0.3}))),false);
});
test('short fist noise cannot override a stable open palm',()=>{
  const controller=new GestureController(),input=createInteraction();
  for(const t of [0,100,200,300])controller.process(frame([hand('open')]),t,input,()=>{});
  const before=input.spread;
  controller.process(frame([hand('fist')]),350,input,()=>{});
  assert.ok(input.spread>=before);
});
