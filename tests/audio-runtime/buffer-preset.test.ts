import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIO_BUFFER_STORAGE_KEY,
  readStoredAudioBufferPreset,
  persistAudioBufferPreset,
  isAudioBufferPreset,
} from "../../src/audio/buffer-preset.js";

test("audio preference persists all three presets with a stable fallback for invalid storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  assert.equal(readStoredAudioBufferPreset(storage), "playback");
  for (const value of ["interactive", "balanced", "playback"] as const) {
    assert.equal(persistAudioBufferPreset(value, storage), true);
    assert.equal(values.get(AUDIO_BUFFER_STORAGE_KEY), value);
    assert.equal(readStoredAudioBufferPreset(storage), value);
  }
  for (const value of ["constructor", "__proto__", "low", "", "0"]) {
    values.set(AUDIO_BUFFER_STORAGE_KEY, value);
    assert.equal(isAudioBufferPreset(value), false);
    assert.equal(readStoredAudioBufferPreset(storage), "playback");
  }
});

test("denied local preference storage never prevents audio settings from working", () => {
  assert.equal(
    readStoredAudioBufferPreset({
      getItem: () => {
        throw Error("denied");
      },
    }),
    "playback",
  );
  assert.equal(
    persistAudioBufferPreset("balanced", {
      setItem: () => {
        throw Error("denied");
      },
    }),
    false,
  );
});
