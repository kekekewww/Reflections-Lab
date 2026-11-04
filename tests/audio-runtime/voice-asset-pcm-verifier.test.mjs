import assert from "node:assert/strict";
import test from "node:test";
import { verifyPcm, TOLERANCE } from "../browser/nonadvanced/voice-asset/verify-pcm.mjs";
const bytes = (values) => Buffer.from(new Float32Array(values).buffer);
test("independent PCM oracle checks every sample including onset and rejects empty/truncated PCM", () => {
  assert.equal(TOLERANCE, 2e-6);
  assert.equal(verifyPcm(bytes([0, 0.5, 0.25]), bytes([0, 0.5, 0.25])).pass, true);
  assert.equal(verifyPcm(bytes([0, 0.5, 0.25]), bytes([0, 0, 0.25])).pass, false);
  assert.equal(verifyPcm(bytes([0.5, 0.25]), bytes([0.5 + 3e-6, 0.25])).aboveTolerance, 1);
  assert.equal(verifyPcm(bytes([NaN, 0.5]), bytes([0, 0.5])).nonFinite, 1);
  assert.throws(() => verifyPcm(Buffer.alloc(0), Buffer.alloc(0)), /PCM_LENGTH/);
  assert.throws(() => verifyPcm(bytes([1]), bytes([1, 2])), /PCM_LENGTH/);
});
