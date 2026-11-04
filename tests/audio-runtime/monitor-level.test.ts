import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MONITOR_GAIN,
  MAX_MONITOR_GAIN,
  MONITOR_MAX_DB,
  MONITOR_MIN_DB,
  PRODUCT_HEADROOM_GAIN,
  gainToDb,
  monitorControlDb,
  monitorGainFromControl,
} from "../../src/audio/monitor-level.js";
import { AudioEngine } from "../../src/audio/engine.js";

test("R18 monitor control is a whole-dB taper over linear digital gain", () => {
  assert.equal(monitorControlDb(DEFAULT_MONITOR_GAIN), 0);
  assert.equal(monitorControlDb(0.18), -15, "the previous default sat 15 dB below unity");
  assert.equal(monitorControlDb(0), MONITOR_MIN_DB, "silence maps to the control floor");
  assert.equal(monitorControlDb(Number.NaN), MONITOR_MIN_DB);
  assert.equal(monitorControlDb(100), MONITOR_MAX_DB);
  for (let db = MONITOR_MIN_DB; db <= MONITOR_MAX_DB; db++)
    assert.equal(monitorControlDb(monitorGainFromControl(db)), db, `round trip ${db} dB`);
  assert.equal(monitorGainFromControl(MONITOR_MAX_DB), MAX_MONITOR_GAIN);
  assert.ok(Math.abs(gainToDb(monitorGainFromControl(-6)) + 6) < 1e-9);
  assert.equal(monitorGainFromControl(99), MAX_MONITOR_GAIN, "the control cannot exceed +12 dB");
  assert.throws(() => monitorGainFromControl(Number.NaN), RangeError);
});

test("R18 engine accepts the +12 dB monitor ceiling and still rejects out-of-range gain", () => {
  const engine = new AudioEngine({
    monitorGain: DEFAULT_MONITOR_GAIN,
    headroomGain: PRODUCT_HEADROOM_GAIN,
  });
  engine.setMonitorGain(MAX_MONITOR_GAIN);
  assert.equal(engine.getTelemetry().monitorGain, MAX_MONITOR_GAIN);
  assert.throws(() => engine.setMonitorGain(MAX_MONITOR_GAIN * 1.01));
  assert.throws(() => engine.setMonitorGain(-0.01));
  assert.throws(() => engine.setMonitorGain(Number.NaN));
  assert.throws(() => new AudioEngine({ monitorGain: MAX_MONITOR_GAIN * 2 }));
  assert.ok(PRODUCT_HEADROOM_GAIN > 0 && PRODUCT_HEADROOM_GAIN <= 1);
});
