import { MAX_PROPAGATION_SECONDS } from "../acoustics/limits.js";
import type { AcousticFrame, AcousticPath } from "../acoustics/types.js";
import { createBandFilterKernel } from "./band-filter.js";
import { AudioEngineError } from "./types.js";
import { finite, smooth, unit } from "./control.js";

const IDENTITY_KERNEL = new Float32Array([1]);

/** Exact Float32 storage equality, including signed zero; no gain rounding or epsilon. */
function identicalKernel(target: Float32Array | null, requested: Float32Array): boolean {
  if (!target || target.length !== requested.length) return false;
  const left = new Uint32Array(target.buffer, target.byteOffset, target.length);
  const right = new Uint32Array(requested.buffer, requested.byteOffset, requested.length);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
}

/** A stable acoustic path owns one delay and one HRTF. Filter banks crossfade. */
export class PathRoute {
  readonly delay: DelayNode;
  readonly gain: GainNode;
  readonly panner: PannerNode;
  readonly convolvers: [ConvolverNode, ConvolverNode];
  readonly bankGains: [GainNode, GainNode];
  private activeBank: 0 | 1 = 0;
  private fadingBank: 0 | 1 | null = null;
  private crossfadeEndsAt = 0;
  private kernelKey = "";
  /** Coefficients of activeBank's requested TARGET, never the fading/retiring bank. */
  private targetKernel: Float32Array | null = null;
  private connected = true;
  private direction: [number, number, number] = [0, 0, -1];
  groupDelaySeconds = 0;
  absoluteDelayS = 0;
  readonly id: string;

  constructor(
    private readonly context: BaseAudioContext,
    private readonly input: AudioNode,
    output: AudioNode,
    frame: AcousticFrame,
    path: AcousticPath,
    panningModel: PanningModelType,
    listenerPosition: readonly number[],
    fadeIn = false,
  ) {
    this.id = path.id;
    this.delay = context.createDelay(MAX_PROPAGATION_SECONDS);
    this.gain = context.createGain();
    this.panner = context.createPanner();
    this.panner.panningModel = panningModel;
    this.panner.distanceModel = "inverse";
    this.panner.rolloffFactor = 0;
    this.panner.refDistance = 1;
    this.panner.maxDistance = 1;
    this.convolvers = [context.createConvolver(), context.createConvolver()];
    this.bankGains = [context.createGain(), context.createGain()];
    for (let i = 0; i < 2; i++) {
      const convolver = this.convolvers[i as 0 | 1],
        gain = this.bankGains[i as 0 | 1];
      convolver.normalize = false;
      gain.gain.value = i === 0 ? 1 : 0;
      convolver.connect(gain);
    }
    this.delay.connect(this.convolvers[0]);
    this.bankGains[0].connect(this.gain);
    this.gain.connect(this.panner);
    this.panner.connect(output);
    input.connect(this.delay);
    this.update(frame, path, listenerPosition, true);
    if (fadeIn) {
      const scale = this.gain.gain.value;
      const arrival = context.currentTime + this.absoluteDelayS + this.groupDelaySeconds;
      this.gain.gain.setValueAtTime(0, context.currentTime);
      this.gain.gain.setValueAtTime(0, arrival);
      this.gain.gain.linearRampToValueAtTime(scale, arrival + 0.02);
    }
  }

  update(
    frame: AcousticFrame,
    path: AcousticPath,
    listenerPosition: readonly number[],
    initial = false,
  ): void {
    const now = this.context.currentTime;
    const delay = finite(path.absoluteDelayS, "path delay", 0, MAX_PROPAGATION_SECONDS);
    this.absoluteDelayS = delay;
    if (initial) this.delay.delayTime.setValueAtTime(delay, now);
    else smooth(this.delay.delayTime, delay, now, 0.03);
    this.direction = unit(path.arrivalDirection);
    this.updateListener(listenerPosition, initial);
    const key = JSON.stringify([frame.bandCentersHz, path.bandGains]);
    if (key !== this.kernelKey && (initial || now >= this.crossfadeEndsAt)) {
      if (this.fadingBank !== null) {
        this.delay.disconnect(this.convolvers[this.fadingBank]);
        this.bankGains[this.fadingBank].disconnect(this.gain);
        this.fadingBank = null;
      }
      const filter = createBandFilterKernel(
        frame.bandCentersHz,
        path.bandGains,
        this.context.sampleRate,
      );
      const data = filter?.kernel ?? IDENTITY_KERNEL;
      const scale = filter?.scale ?? path.bandGains[0] ?? 0;
      this.groupDelaySeconds = filter?.groupDelaySeconds ?? 0;
      if (initial || !identicalKernel(this.targetKernel, data)) {
        const buffer = this.context.createBuffer(1, data.length, this.context.sampleRate);
        buffer.getChannelData(0).set(data);
        if (initial) this.convolvers[this.activeBank].buffer = buffer;
        else {
          const old = this.activeBank,
            next = (old === 0 ? 1 : 0) as 0 | 1;
          this.convolvers[next].buffer = buffer;
          this.bankGains[next].gain.setValueAtTime(0, now);
          this.delay.connect(this.convolvers[next]);
          this.bankGains[next].connect(this.gain);
          smooth(this.bankGains[next].gain, 1, now, 0.02);
          smooth(this.bankGains[old].gain, 0, now, 0.02);
          this.activeBank = next;
          this.fadingBank = old;
        }
        this.targetKernel = data;
      }
      if (initial) this.gain.gain.setValueAtTime(scale, now);
      else {
        // Keep the original scale trajectory and response-admission gate even when
        // only pressure scale changed. Delay/direction ramps above always run.
        smooth(this.gain.gain, scale, now, 0.02);
        this.crossfadeEndsAt = now + 0.02;
      }
      this.kernelKey = key;
    }
  }

  updateListener(position: readonly number[], initial = false): void {
    const now = this.context.currentTime;
    const coords = this.direction.map((v, i) => v + (position[i] ?? 0));
    const params = [this.panner.positionX, this.panner.positionY, this.panner.positionZ];
    for (let i = 0; i < 3; i++) {
      const param = params[i],
        value = coords[i];
      if (!param || value === undefined) continue;
      if (initial) param.setValueAtTime(value, now);
      else smooth(param, value, now, 0.02);
    }
  }

  fadeOut(seconds = 0.02): void {
    smooth(this.gain.gain, 0, this.context.currentTime, seconds);
  }
  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    this.targetKernel = null;
    try {
      this.input.disconnect(this.delay);
    } catch {
      /* Already disconnected by parent disposal. */
    }
    this.delay.disconnect();
    this.gain.disconnect();
    this.panner.disconnect();
    for (const n of this.convolvers) n.disconnect();
    for (const n of this.bankGains) n.disconnect();
  }
}

export function validateFrame(frame: AcousticFrame, sampleRate = 48000): void {
  if (
    frame.gainQuantity !== "pressureRatio" ||
    frame.bandCentersHz.length === 0 ||
    frame.bandCentersHz.length > 32
  )
    throw new AudioEngineError("INVALID_FRAME", "Expected pressure-ratio frequency bands");
  if (frame.paths.length > 256) throw new AudioEngineError("INVALID_FRAME", "Too many paths");
  for (let i = 0; i < frame.bandCentersHz.length; i++) {
    const frequency = frame.bandCentersHz[i]!;
    finite(frequency, "band center", 20, sampleRate / 2);
    if (i > 0 && frequency <= frame.bandCentersHz[i - 1]!)
      throw new AudioEngineError("INVALID_FRAME", "Band centers must strictly increase");
  }
  if (
    !Number.isSafeInteger(frame.sceneRevision) ||
    !Number.isSafeInteger(frame.geometryRevision) ||
    !Number.isSafeInteger(frame.poseTick) ||
    frame.sceneRevision < 0 ||
    frame.geometryRevision < 0 ||
    frame.poseTick < 0
  )
    throw new AudioEngineError(
      "INVALID_FRAME_REVISION",
      "Frame revision/tick must be nonnegative integer",
    );
  const ids = new Set<string>();
  for (const path of frame.paths) {
    if (
      ids.has(path.id) ||
      path.sourceId !== frame.sourceId ||
      path.listenerId !== frame.listenerId ||
      path.bandGains.length !== frame.bandCentersHz.length
    )
      throw new AudioEngineError("INVALID_PATH", "Path identity/bands do not belong to frame");
    ids.add(path.id);
    finite(path.absoluteDelayS, "path delay", 0, MAX_PROPAGATION_SECONDS);
    unit(path.arrivalDirection);
    for (const gain of path.bandGains) finite(gain, "pressure gain", 0, 100);
  }
}
