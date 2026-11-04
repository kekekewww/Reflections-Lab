import assert from "node:assert/strict";
import test from "node:test";
import {
  SAFETY_CEILING,
  SAFETY_CURVE_SAMPLES,
  SAFETY_KNEE,
  outputSafetyCurve,
} from "../../src/audio/output-safety.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "./fake-context.js";

const sampleAt = (curve: Float32Array, x: number) => {
  const position = ((x + 1) / 2) * (curve.length - 1);
  const low = Math.floor(position),
    high = Math.min(curve.length - 1, low + 1),
    weight = position - low;
  return curve[low]! * (1 - weight) + curve[high]! * weight;
};

test("R18 review: the output safety curve is exactly linear below -1 dBFS and bounded below full scale", () => {
  const curve = outputSafetyCurve();
  assert.equal(curve.length, SAFETY_CURVE_SAMPLES);
  for (const x of [-0.8, -0.5, -0.1, 0, 0.1, 0.5, 0.8, SAFETY_KNEE * 0.99])
    assert.ok(Math.abs(sampleAt(curve, x) - x) < 1e-6, `identity at ${x}`);
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i]! >= curve[i - 1]!, "monotonic");
  for (const value of curve) assert.ok(Math.abs(value) < SAFETY_CEILING && Math.abs(value) < 1);
  // The WaveShaper clamps inputs beyond [-1, 1] to the end values, so overs stay bounded.
  assert.ok(curve[curve.length - 1]! < 1 && curve[0]! > -1);
  for (let i = 0; i < curve.length; i++)
    assert.ok(Math.abs(curve[i]! + curve[curve.length - 1 - i]!) < 1e-7, "odd symmetric");
  assert.throws(() => outputSafetyCurve(4), RangeError);
});

test("R18 review: product engines route the limiter through the safety ceiling; library default does not", async () => {
  for (const outputSafetyClip of [true, false]) {
    const context = new FakeAudioContext();
    const engine = new AudioEngine({
      context: context as unknown as BaseAudioContext,
      outputSafetyClip,
    });
    const nodes = (context as unknown as { nodes: { kind: string; curve?: Float32Array }[] }).nodes;
    const shaper = nodes.filter((node) => node.kind === "waveshaper");
    assert.equal(shaper.length, outputSafetyClip ? 1 : 0, String(outputSafetyClip));
    if (outputSafetyClip) assert.ok(shaper[0]!.curve instanceof Float32Array);
    engine.dispose();
  }
});
