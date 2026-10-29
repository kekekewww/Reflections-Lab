import { finite, smooth } from "./control.js";
import { AudioEngineError, type LateReverbSettings } from "./types.js";

/** Original deterministic mono diffusion IR. It predicts no room metric or individual ray. */
export function createSyntheticLateIR(
  context: BaseAudioContext,
  decaySeconds: number,
  seed: number,
): AudioBuffer {
  const length = Math.ceil(context.sampleRate * decaySeconds);
  const buffer = context.createBuffer(1, length, context.sampleRate),
    data = buffer.getChannelData(0);
  let state = seed >>> 0 || 1,
    energy = 0;
  const onset = Math.round(context.sampleRate * 0.03);
  for (let i = onset; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const noise = ((state >>> 0) / 0x100000000) * 2 - 1;
    const time = i / context.sampleRate;
    const attack = Math.min(1, (i - onset) / (context.sampleRate * 0.01));
    const value = noise * attack * Math.exp((-Math.log(1000) * time) / decaySeconds);
    data[i] = value;
    energy += value * value;
  }
  const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0;
  for (let i = onset; i < length; i++) data[i] = data[i]! * scale;
  return buffer;
}

/** Two bounded IR banks crossfade on the audio clock, with one coalesced pending update. */
export class LateReverbBus {
  readonly input: GainNode;
  private readonly wet: GainNode;
  private convolvers: [ConvolverNode, ConvolverNode];
  private bankGains: [GainNode, GainNode];
  private active: 0 | 1 = 0;
  private crossfadeEnd = 0;
  private pending: LateReverbSettings | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private irSettings: LateReverbSettings | null = null;
  settings: LateReverbSettings = { enabled: false, decaySeconds: 1.2, wetGain: 0.15, seed: 1 };
  constructor(
    private readonly context: BaseAudioContext,
    output: AudioNode,
    private readonly maxBytes: number,
  ) {
    this.input = context.createGain();
    this.wet = context.createGain();
    this.wet.gain.value = 0;
    this.wet.connect(output);
    this.convolvers = [context.createConvolver(), context.createConvolver()];
    this.bankGains = [context.createGain(), context.createGain()];
    this.connectBanks();
  }
  private connectBanks(): void {
    for (let i = 0; i < 2; i++) {
      this.convolvers[i as 0 | 1].normalize = false;
      this.bankGains[i as 0 | 1].gain.value = i === this.active ? 1 : 0;
      this.input.connect(this.convolvers[i as 0 | 1]);
      this.convolvers[i as 0 | 1].connect(this.bankGains[i as 0 | 1]);
      this.bankGains[i as 0 | 1].connect(this.wet);
    }
  }
  set(update: Partial<LateReverbSettings> & { enabled: boolean }): void {
    if (typeof update.enabled !== "boolean")
      throw new AudioEngineError("INVALID_REVERB", "enabled must be boolean");
    const next = { ...this.settings, ...update };
    finite(next.decaySeconds, "synthetic IR duration", 0.1, 4);
    finite(next.wetGain, "late wet gain", 0, 1);
    finite(next.seed, "synthetic IR seed", 0, 0xffffffff);
    if (!Number.isSafeInteger(next.seed))
      throw new AudioEngineError("INVALID_REVERB_SEED", "Expected uint32 seed");
    if (Math.ceil(this.context.sampleRate * next.decaySeconds) * 4 * 2 > this.maxBytes)
      throw new AudioEngineError("REVERB_MEMORY_BUDGET", "Two IR banks exceed configured budget");
    this.settings = next;
    smooth(this.wet.gain, next.enabled ? next.wetGain : 0, this.context.currentTime, 0.02);
    if (!next.enabled) return;
    if (this.irSettings?.decaySeconds === next.decaySeconds && this.irSettings.seed === next.seed) {
      this.pending = null;
      return;
    }
    if (this.context.currentTime < this.crossfadeEnd) {
      this.pending = { ...next };
      this.schedulePending();
      return;
    }
    this.pending = null;
    this.applyIR(next);
  }
  private applyIR(next: LateReverbSettings): void {
    const buffer = createSyntheticLateIR(this.context, next.decaySeconds, next.seed),
      now = this.context.currentTime;
    if (!this.irSettings) {
      this.convolvers[this.active].buffer = buffer;
    } else {
      const old = this.active,
        incoming = (old === 0 ? 1 : 0) as 0 | 1;
      this.convolvers[incoming].buffer = buffer;
      // Prime through the IR's explicit 30ms zero-onset before fading the old response.
      const start = now + 0.03;
      this.bankGains[incoming].gain.cancelScheduledValues(now);
      this.bankGains[incoming].gain.setValueAtTime(0, now);
      this.bankGains[incoming].gain.setValueAtTime(0, start);
      this.bankGains[incoming].gain.linearRampToValueAtTime(1, start + 0.02);
      this.bankGains[old].gain.cancelScheduledValues(now);
      this.bankGains[old].gain.setValueAtTime(1, now);
      this.bankGains[old].gain.setValueAtTime(1, start);
      this.bankGains[old].gain.linearRampToValueAtTime(0, start + 0.02);
      this.active = incoming;
      this.crossfadeEnd = start + 0.02;
    }
    this.irSettings = { ...next };
  }
  private schedulePending(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.disposed || !this.pending) return;
      if (this.context.currentTime < this.crossfadeEnd) {
        this.schedulePending();
        return;
      }
      const next = this.pending;
      this.pending = null;
      if (this.settings.enabled) this.applyIR(next);
    }, 25);
  }
  get decodedBytes(): number {
    return this.convolvers.reduce(
      (n, c) => n + (c.buffer ? c.buffer.length * c.buffer.numberOfChannels * 4 : 0),
      0,
    );
  }
  /** Explicit interrupted boundary: discard old convolution state, retain immutable IR buffers. */
  clearTail(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    const buffers = this.convolvers.map((c) => c.buffer);
    this.input.disconnect();
    for (const node of [...this.convolvers, ...this.bankGains]) node.disconnect();
    this.convolvers = [this.context.createConvolver(), this.context.createConvolver()];
    this.bankGains = [this.context.createGain(), this.context.createGain()];
    this.connectBanks();
    this.convolvers[0].buffer = buffers[0] ?? null;
    this.convolvers[1].buffer = buffers[1] ?? null;
    this.crossfadeEnd = 0;
    if (
      this.settings.enabled &&
      this.irSettings &&
      (this.settings.seed !== this.irSettings.seed ||
        this.settings.decaySeconds !== this.irSettings.decaySeconds)
    )
      this.applyIR(this.settings);
  }
  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    for (const convolver of this.convolvers) convolver.buffer = null;
    this.settings = { ...this.settings, enabled: false };
    for (const node of [this.input, this.wet, ...this.convolvers, ...this.bankGains])
      node.disconnect();
  }
}
