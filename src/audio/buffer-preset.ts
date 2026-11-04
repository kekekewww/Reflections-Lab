export type AudioBufferPreset = "interactive" | "balanced" | "playback";
export const DEFAULT_AUDIO_BUFFER_PRESET: AudioBufferPreset = "playback";
export const AUDIO_BUFFER_STORAGE_KEY = "reflection-lab.audio-buffer";
export const AUDIO_LOOKAHEAD_SECONDS: Readonly<Record<AudioBufferPreset, number>> = Object.freeze({
  interactive: 0.06,
  balanced: 0.08,
  playback: 0.12,
});
export function isAudioBufferPreset(value: unknown): value is AudioBufferPreset {
  return value === "interactive" || value === "balanced" || value === "playback";
}
export function readStoredAudioBufferPreset(storage?: Pick<Storage, "getItem">): AudioBufferPreset {
  try {
    const source = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    const value = source?.getItem(AUDIO_BUFFER_STORAGE_KEY);
    return isAudioBufferPreset(value) ? value : DEFAULT_AUDIO_BUFFER_PRESET;
  } catch {
    return DEFAULT_AUDIO_BUFFER_PRESET;
  }
}
export function persistAudioBufferPreset(
  preset: AudioBufferPreset,
  storage?: Pick<Storage, "setItem">,
): boolean {
  try {
    const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    if (!target) return false;
    target.setItem(AUDIO_BUFFER_STORAGE_KEY, preset);
    return true;
  } catch {
    return false;
  }
}
