import {
  LIVE_MONITOR_FFT_SIZE,
  LIVE_MONITOR_SOURCE_TRACK_LIMIT,
  type LiveAudioMonitorFrame,
  type LiveAudioMonitorTrack,
} from "../audio/live-monitor.js";

export interface LiveMonitorNamedObject {
  readonly id: string;
  readonly name?: string;
}
export interface LiveMonitorVoiceOwner {
  readonly event: { readonly objectId: string };
}

const CAPACITY = 8;
const EMPTY_TRACK: LiveAudioMonitorTrack = {
  id: "",
  label: "",
  kind: "source",
  peakDbfs: null,
  rmsDbfs: null,
  point: "contentPrePropagation",
};
const EMPTY_FRAME: LiveAudioMonitorFrame = {
  state: "unavailable",
  reason: "MONITOR_RELEASED",
  sampleRateHz: null,
  fftSize: LIVE_MONITOR_FFT_SIZE,
  waveform: null,
  spectrumDbfs: null,
  tracks: [],
  displayInput: "master-left",
  frequencyBinHz: null,
  sampledAtAudioTimeSeconds: null,
  analyserNodeCount: 0,
  tapNodeCount: 0,
  spectrumNormalization: "nativeBlackmanFft;notPeakOrRmsMeter",
  sourceTrackLimit: LIVE_MONITOR_SOURCE_TRACK_LIMIT,
  sampledSourceVoices: 0,
  warmingSourceVoices: 0,
  unmeasuredVirtualVoices: 0,
  unmeasuredPendingVoices: 0,
  unmeasuredNativeVoices: 0,
};
type OwnedFrame = Omit<LiveAudioMonitorFrame, "tracks"> & { tracks: LiveAudioMonitorTrack[] };
interface Slot {
  id: string | null;
  kind: LiveAudioMonitorTrack["kind"] | null;
  objectId: string | null;
  lastLabel: string | null;
  sourceNumber: number;
  retained: boolean;
  readonly track: LiveAudioMonitorTrack;
}

/** A new sparse snapshot must not inherit optional metadata from a previous lifetime. */
function copyExact(target: object, source: object): void {
  const fields = target as Record<string, unknown>;
  for (const key in fields) if (!Object.hasOwn(source, key)) delete fields[key];
  Object.assign(target, source);
}

/** Bounded display projection only. It never edits native frames, IDs, meters or borrowed samples. */
export class LiveMonitorLabelProjection {
  private readonly tracks: LiveAudioMonitorTrack[] = [];
  private readonly frame: OwnedFrame = { ...EMPTY_FRAME, tracks: this.tracks };
  private readonly slots: Slot[] = Array.from({ length: CAPACITY }, () => ({
    id: null,
    kind: null,
    objectId: null,
    lastLabel: null,
    sourceNumber: 0,
    retained: false,
    track: { ...EMPTY_TRACK },
  }));
  private objects: readonly LiveMonitorNamedObject[] | null = null;
  private epoch: string | null = null;

  project(
    raw: LiveAudioMonitorFrame,
    owners: ReadonlyMap<string, LiveMonitorVoiceOwner>,
    objects: readonly LiveMonitorNamedObject[],
    epoch: string,
  ): LiveAudioMonitorFrame {
    if (this.epoch !== epoch) {
      this.clear();
      this.epoch = epoch;
    }
    const namesChanged = this.objects !== objects;
    const count = Math.min(CAPACITY, raw.tracks.length);
    for (const slot of this.slots) slot.retained = false;
    // Retain all surviving identities before a new track can claim any vacancy.
    for (let index = 0; index < count; index++) {
      const source = raw.tracks[index]!;
      const slot = this.find(source.kind, source.id);
      if (slot) slot.retained = true;
    }
    for (const slot of this.slots) if (!slot.retained) this.clearSlot(slot);
    this.tracks.length = count;
    for (let index = 0; index < count; index++) {
      const source = raw.tracks[index]!;
      let slot = this.find(source.kind, source.id);
      if (!slot) {
        slot = this.vacancy();
        slot.id = source.id;
        slot.kind = source.kind;
        if (source.kind === "source") slot.sourceNumber = this.sourceNumber(slot);
      }
      const owner = source.kind === "source" ? owners.get(source.id) : undefined;
      const ownerChanged = owner !== undefined && owner.event.objectId !== slot.objectId;
      if (ownerChanged) {
        slot.objectId = owner.event.objectId;
        slot.lastLabel = null;
      }
      if (
        source.kind === "source" &&
        slot.objectId &&
        (namesChanged || ownerChanged || !slot.lastLabel)
      ) {
        for (const object of objects) {
          if (object.id === slot.objectId) {
            slot.lastLabel = object.name ?? object.id;
            break;
          }
        }
      }
      copyExact(slot.track, source);
      if (source.kind === "source") {
        slot.track.label = slot.lastLabel ?? `Source ${slot.sourceNumber}`;
      }
      this.tracks[index] = slot.track;
    }
    this.objects = objects;
    copyExact(this.frame, raw);
    this.frame.tracks = this.tracks;
    return this.frame;
  }

  clear(): void {
    for (const slot of this.slots) this.clearSlot(slot);
    this.tracks.length = 0;
    copyExact(this.frame, EMPTY_FRAME);
    this.frame.tracks = this.tracks;
    this.objects = null;
    this.epoch = null;
  }

  private clearSlot(slot: Slot): void {
    slot.id = null;
    slot.kind = null;
    slot.objectId = null;
    slot.lastLabel = null;
    slot.sourceNumber = 0;
    slot.retained = false;
    copyExact(slot.track, EMPTY_TRACK);
  }
  private find(kind: LiveAudioMonitorTrack["kind"], id: string): Slot | undefined {
    for (const slot of this.slots) if (slot.kind === kind && slot.id === id) return slot;
    return undefined;
  }
  private vacancy(): Slot {
    for (const slot of this.slots) if (slot.id === null) return slot;
    throw new Error("LIVE_MONITOR_LABEL_CAPACITY");
  }
  /** Display-only numbering; it is never a source or persistent domain ID. */
  private sourceNumber(own: Slot): number {
    for (let number = 1; number <= CAPACITY; number++) {
      let occupied = false;
      for (const slot of this.slots) {
        if (slot !== own && slot.kind === "source" && slot.sourceNumber === number) occupied = true;
      }
      if (!occupied) return number;
    }
    throw new Error("LIVE_MONITOR_LABEL_NUMBER_CAPACITY");
  }
}
