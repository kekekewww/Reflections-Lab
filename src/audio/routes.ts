import { MAX_PROPAGATION_SECONDS } from "../acoustics/limits.js";
import type { AcousticFrame, AcousticPath } from "../acoustics/types.js";
import { createBandFilterKernel } from "./band-filter.js";
import { AudioEngineError } from "./types.js";
import { finite, smooth, smoothTarget, unit } from "./control.js";
import { prepareRouteResponse, type RouteResponseTarget } from "./route-response.js";
import type { AudioDiagnostics } from "./diagnostics.js";
import { DeterministicMixInput, type DeterministicMixHandle } from "./deterministic-mix.js";

const IDENTITY_KERNEL = new Float32Array([1]);

export const ROUTE_FADE_SECONDS = 0.02;
/**
 * A native HRTF panner still outputs after its input stops. Disconnecting a retired route right
 * after its fade clicked on every path change; this much extra time removed those clicks.
 * Measured in artifacts/v1/audio-path-clicks-20261104.
 */
export const ROUTE_RETIRE_TAIL_SECONDS = 0.1;
/**
 * HRTF panners click on sharp direction changes. With a moving source, 40 ms removed the louder clicks
 * heard at 20 ms with no clear rise in dropouts; 100 ms brought more dropouts.
 * Listener position uses the same ramp: a panner sits at listener + direction, so a different ramp
 * would skew the direction while walking.
 */
export const ROUTE_DIRECTION_RAMP_SECONDS = 0.04;
/** A longer ramp on listener turning brought dropouts without fewer clicks, so turning stays at 20 ms. */
export const LISTENER_TURN_RAMP_SECONDS = 0.02;

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
  private shapeKey = "";
  private pendingShape: RouteResponseTarget | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private retiring = false;
  private scalarTarget = NaN;
  private birthArrival: number | null = null;
  private birthEndsAt = 0;
  /** Coefficients of activeBank's requested TARGET, never the fading/retiring bank. */
  private targetKernel: Float32Array | null = null;
  private connected = true;
  private readonly mixHandle: DeterministicMixHandle | null;
  private direction: [number, number, number] = [0, 0, -1];
  groupDelaySeconds = 0;
  absoluteDelayS = 0;
  readonly id: string;

  constructor(
    private readonly context: BaseAudioContext,
    private readonly input: AudioNode,
    private readonly output: AudioNode | DeterministicMixInput,
    frame: AcousticFrame,
    path: AcousticPath,
    panningModel: PanningModelType,
    listenerPosition: readonly number[],
    fadeIn = false,
    private readonly controlInterval = 0.02,
    private readonly diagnostics?: AudioDiagnostics,
  ) {
    this.diagnostics?.increment("routeCreates");
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
    this.mixHandle = output instanceof DeterministicMixInput ? output.attach(this.panner) : null;
    if (!(output instanceof DeterministicMixInput)) this.panner.connect(output);
    input.connect(this.delay);
    this.update(frame, path, listenerPosition, true);
    if (fadeIn) {
      const scale = this.scalarTarget;
      const arrival = context.currentTime + this.absoluteDelayS + this.groupDelaySeconds;
      this.birthArrival = arrival;
      this.birthEndsAt = arrival + 0.02;
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
    if (!this.connected || this.retiring) return;
    const started = this.diagnostics?.enabled ? performance.now() : null;
    try {
      const now = this.context.currentTime;
      const interval = this.controlInterval;
      const delay = finite(path.absoluteDelayS, "path delay", 0, MAX_PROPAGATION_SECONDS);
      this.absoluteDelayS = delay;
      if (initial) {
        this.delay.delayTime.setValueAtTime(delay, now);
        this.diagnostics?.increment("delayUpdates");
      } else {
        const changed = smoothTarget(
          this.delay.delayTime,
          delay,
          now,
          Math.max(0.03, interval),
          1e-6,
        );
        this.diagnostics?.increment(changed ? "delayUpdates" : "delaySkips");
      }
      this.direction = unit(path.arrivalDirection);
      this.updateListener(listenerPosition, initial);
      const target = prepareRouteResponse(
        frame.bandCentersHz,
        path.bandGains,
        this.context.sampleRate,
      );
      // Pressure is independent of spectral-bank admission. A changing gain cannot
      // be held behind an unrelated 20–100 ms FIR transition.
      if (initial) {
        this.scalarTarget = target.scale;
        this.gain.gain.setValueAtTime(target.scale, now);
        this.diagnostics?.increment("scalarGainUpdates");
      } else {
        // Requested scalar and the audible birth envelope are different state.
        // AudioParam.value can still be zero/mid-ramp when a target is re-sent.
        const changed = target.scale !== this.scalarTarget;
        if (changed) {
          this.scalarTarget = target.scale;
          if (this.birthArrival !== null && now < this.birthArrival) {
            this.gain.gain.cancelScheduledValues(now);
            this.gain.gain.setValueAtTime(0, now);
            this.gain.gain.setValueAtTime(0, this.birthArrival);
            this.gain.gain.linearRampToValueAtTime(target.scale, this.birthEndsAt);
          } else
            smooth(
              this.gain.gain,
              target.scale,
              now,
              now < this.birthEndsAt ? this.birthEndsAt - now : interval,
            );
        }
        this.diagnostics?.increment(changed ? "scalarGainUpdates" : "scalarGainSkips");
      }
      if (initial) this.applyShape(target, true);
      else {
        // At most one unsent shape. Replacing it does not replace recorded frames;
        // this is only the perceptually crossfaded native-render target.
        if (target.shapeKey === this.shapeKey) {
          this.pendingShape = null;
          this.diagnostics?.increment("shapeReuses");
        } else {
          if (target.shapeKey !== this.pendingShape?.shapeKey && now < this.crossfadeEndsAt)
            this.diagnostics?.increment("shapeDeferred");
          this.pendingShape = target;
        }
        this.flushControlUpdates();
      }
    } finally {
      if (started !== null) this.diagnostics?.timing("routeControl", performance.now() - started);
    }
  }

  private applyShape(target: RouteResponseTarget, initial = false): void {
    const now = this.context.currentTime;
    this.diagnostics?.increment("shapeBuilds");
    const filter = target.uniform
      ? null
      : createBandFilterKernel(target.bandCentersHz, target.bandGains, this.context.sampleRate);
    const data = filter?.kernel ?? IDENTITY_KERNEL;
    this.groupDelaySeconds = filter?.groupDelaySeconds ?? 0;
    if (initial || !identicalKernel(this.targetKernel, data)) {
      const buffer = this.context.createBuffer(1, data.length, this.context.sampleRate);
      buffer.getChannelData(0).set(data);
      this.diagnostics?.increment("shapeUploads");
      if (initial) this.convolvers[this.activeBank].buffer = buffer;
      else {
        const old = this.activeBank,
          next = (old === 0 ? 1 : 0) as 0 | 1;
        this.convolvers[next].buffer = buffer;
        this.bankGains[next].gain.setValueAtTime(0, now);
        this.delay.connect(this.convolvers[next]);
        this.bankGains[next].connect(this.gain);
        smooth(this.bankGains[next].gain, 1, now, this.controlInterval);
        smooth(this.bankGains[old].gain, 0, now, this.controlInterval);
        this.activeBank = next;
        this.fadingBank = old;
        this.crossfadeEndsAt = now + this.controlInterval;
      }
      this.targetKernel = data;
    } else this.diagnostics?.increment("shapeReuses");
    this.shapeKey = target.shapeKey;
    this.scheduleSettle();
  }

  /** Audio-clock boundary; offline renderers call this at suspend checkpoints. */
  flushControlUpdates(): void {
    if (!this.connected) return;
    const now = this.context.currentTime;
    if (this.fadingBank !== null && now + 1e-9 >= this.crossfadeEndsAt) {
      this.delay.disconnect(this.convolvers[this.fadingBank]);
      this.bankGains[this.fadingBank].disconnect(this.gain);
      this.fadingBank = null;
      this.diagnostics?.increment("bankRetirements");
    }
    if (this.fadingBank === null && this.pendingShape && !this.retiring) {
      const target = this.pendingShape;
      this.pendingShape = null;
      if (target.shapeKey !== this.shapeKey) this.applyShape(target);
    }
    this.scheduleSettle();
  }

  private scheduleSettle(): void {
    // Offline rendering can advance many audio seconds before a wall timer fires.
    // Its caller owns explicit checkpoints instead of relying on wall-clock luck.
    if (
      !this.connected ||
      this.fadingBank === null ||
      this.settleTimer !== null ||
      "startRendering" in this.context
    )
      return;
    const delayMs =
      this.context.state === "suspended"
        ? 100
        : Math.max(
            10,
            Math.min(1000, (this.crossfadeEndsAt - this.context.currentTime) * 1000 + 5),
          );
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.flushControlUpdates();
    }, delayMs);
    // Node control fixtures must not keep their process alive with a frozen fake clock.
    (this.settleTimer as unknown as { unref?: () => void }).unref?.();
  }

  updateListener(position: readonly number[], initial = false): void {
    const now = this.context.currentTime;
    const coords = this.direction.map((v, i) => v + (position[i] ?? 0));
    const params = [this.panner.positionX, this.panner.positionY, this.panner.positionZ];
    for (let i = 0; i < 3; i++) {
      const param = params[i],
        value = coords[i];
      if (!param || value === undefined) continue;
      if (initial) {
        param.setValueAtTime(value, now);
        this.diagnostics?.increment("directionUpdates");
      } else {
        const changed = smoothTarget(param, value, now, ROUTE_DIRECTION_RAMP_SECONDS, 1e-4);
        this.diagnostics?.increment(changed ? "directionUpdates" : "directionSkips");
      }
    }
  }

  fadeOut(seconds = ROUTE_FADE_SECONDS): void {
    this.retiring = true;
    this.pendingShape = null;
    this.diagnostics?.increment("routeRetires");
    smooth(this.gain.gain, 0, this.context.currentTime, seconds);
  }
  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    this.pendingShape = null;
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = null;
    this.targetKernel = null;
    try {
      this.input.disconnect(this.delay);
    } catch {
      /* Already disconnected by parent disposal. */
    }
    this.delay.disconnect();
    this.gain.disconnect();
    if (this.output instanceof DeterministicMixInput) this.output.detach(this.mixHandle!);
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
