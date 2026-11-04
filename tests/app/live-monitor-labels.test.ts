import assert from "node:assert/strict";
import test from "node:test";
import type { LiveAudioMonitorFrame, LiveAudioMonitorTrack } from "../../src/audio/live-monitor.js";
import { LiveMonitorLabelProjection } from "../../src/app/live-monitor-labels.js";

function track(id: string, kind: "output" | "source" = "source"): LiveAudioMonitorTrack {
  return {
    id,
    label: id,
    kind,
    peakDbfs: -12,
    rmsDbfs: -15,
    ...(kind === "source" ? { sourceId: `source.${id}`, instanceId: id } : {}),
    point: kind === "source" ? "contentPrePropagation" : "postLimiterAndMute",
  };
}
function frame(tracks: readonly LiveAudioMonitorTrack[]): LiveAudioMonitorFrame {
  return {
    state: "active",
    reason: null,
    sampleRateHz: 48000,
    fftSize: 2048,
    waveform: new Float32Array([0.25, -0.25]),
    spectrumDbfs: new Float32Array([-20, -Infinity]),
    tracks,
    displayInput: "master-left",
    frequencyBinHz: 23.4375,
    sampledAtAudioTimeSeconds: 12.5,
    analyserNodeCount: 4,
    tapNodeCount: 8,
    spectrumNormalization: "nativeBlackmanFft;notPeakOrRmsMeter",
    sourceTrackLimit: 6,
    sampledSourceVoices: 1,
    warmingSourceVoices: 0,
    unmeasuredVirtualVoices: 3,
    unmeasuredPendingVoices: 2,
    unmeasuredNativeVoices: 1,
  };
}
const objects = [
  { id: "ball", name: "Rubber ball" },
  { id: "speaker", name: "Speaker" },
];
const owners = (...entries: [string, string][]) =>
  new Map(entries.map(([id, objectId]) => [id, { event: { objectId } }]));

test("names use the trusted instance owner and leave frozen native data and stable IDs untouched", () => {
  const source = Object.freeze(track("voice.opaque"));
  const raw = Object.freeze(frame(Object.freeze([source])));
  const projection = new LiveMonitorLabelProjection();
  const output = projection.project(raw, owners([source.id, "ball"]), objects, "epoch");
  assert.equal(output.tracks[0]!.label, "Rubber ball");
  assert.notStrictEqual(output, raw);
  assert.notStrictEqual(output.tracks, raw.tracks);
  assert.notStrictEqual(output.tracks[0], source);
  assert.equal(raw.tracks[0]!.label, "voice.opaque");
  assert.equal(output.tracks[0]!.id, source.id);
  assert.equal(output.tracks[0]!.sourceId, source.sourceId);
  assert.equal(output.tracks[0]!.instanceId, source.instanceId);
  assert.equal(output.tracks[0]!.point, source.point);
  assert.equal(output.tracks[0]!.peakDbfs, -12);
});

test("one owned frame and track array preserve current native metadata and borrowed buffers", () => {
  const projection = new LiveMonitorLabelProjection();
  const raw = Object.assign(frame([track("voice.a")]), { futureDiagnostic: { version: 1 } });
  const first = projection.project(raw, owners(["voice.a", "ball"]), objects, "epoch");
  const ownTracks = first.tracks;
  for (const key of Object.keys(raw)) {
    if (key !== "tracks")
      assert.strictEqual(
        (first as unknown as Record<string, unknown>)[key],
        (raw as unknown as Record<string, unknown>)[key],
      );
  }
  const next = frame([track("voice.a")]);
  next.state = "paused";
  next.reason = "CONTEXT_SUSPENDED";
  next.sampleRateHz = null;
  next.waveform = null;
  next.spectrumDbfs = null;
  next.frequencyBinHz = null;
  next.sampledAtAudioTimeSeconds = null;
  next.analyserNodeCount = 0;
  next.tapNodeCount = 0;
  const second = projection.project(next, owners(), objects, "epoch");
  assert.strictEqual(second, first);
  assert.strictEqual(second.tracks, ownTracks);
  for (const key of Object.keys(next)) {
    if (key !== "tracks")
      assert.strictEqual(
        (second as unknown as Record<string, unknown>)[key],
        (next as unknown as Record<string, unknown>)[key],
      );
  }
  assert.equal(
    "futureDiagnostic" in second,
    false,
    "sparse optional metadata must not survive a new native snapshot",
  );
});

test("stable kind and ID retain owned track identity through native reordering", () => {
  const projection = new LiveMonitorLabelProjection();
  const a = track("a"),
    b = track("b");
  const first = projection.project(
    frame([a, b]),
    owners(["a", "ball"], ["b", "speaker"]),
    objects,
    "epoch",
  );
  const ownA = first.tracks[0],
    ownB = first.tracks[1];
  b.rmsDbfs = -Infinity;
  a.peakDbfs = null;
  const reordered = projection.project(frame([b, a]), owners(), objects, "epoch");
  assert.strictEqual(reordered.tracks[0], ownB);
  assert.strictEqual(reordered.tracks[1], ownA);
  assert.equal(reordered.tracks[0]!.label, "Speaker");
  assert.equal(reordered.tracks[0]!.rmsDbfs, -Infinity);
  assert.equal(reordered.tracks[1]!.peakDbfs, null);
});

test("new tracks cannot steal a retained fading track slot before the whole snapshot is matched", () => {
  const projection = new LiveMonitorLabelProjection();
  const first = projection.project(
    frame([track("b"), track("a")]),
    owners(["b", "speaker"], ["a", "ball"]),
    objects,
    "epoch",
  );
  const fadingB = first.tracks[0];
  const next = projection.project(
    frame([track("c"), track("b")]),
    owners(["c", "ball"]),
    objects,
    "epoch",
  );
  assert.strictEqual(next.tracks[1], fadingB);
  assert.equal(next.tracks[1]!.label, "Speaker");
  assert.equal(next.tracks[0]!.label, "Rubber ball");
});

test("a fading owner follows a new published name array even when external revisions are equal", () => {
  const projection = new LiveMonitorLabelProjection();
  const before = { sceneRevision: 7, objects: [{ id: "ball", name: "Before" }] };
  const after = { sceneRevision: 7, objects: [{ id: "ball", name: "Renamed ball" }] };
  projection.project(frame([track("a")]), owners(["a", "ball"]), before.objects, "epoch");
  assert.equal(before.sceneRevision, after.sceneRevision);
  const output = projection.project(frame([track("a")]), owners(), after.objects, "epoch");
  assert.equal(output.tracks[0]!.label, "Renamed ball");
});

test("removed scene objects do not erase a fading track's last known human label", () => {
  const projection = new LiveMonitorLabelProjection();
  projection.project(frame([track("a")]), owners(["a", "ball"]), objects, "epoch");
  const output = projection.project(frame([track("a")]), owners(), [], "epoch");
  assert.equal(output.tracks[0]!.label, "Rubber ball");
});

test("released native tracks cannot donate remembered owners to a later same-ID appearance", () => {
  const projection = new LiveMonitorLabelProjection();
  projection.project(frame([track("a")]), owners(["a", "ball"]), objects, "epoch");
  projection.project(frame([]), owners(), objects, "epoch");
  const output = projection.project(frame([track("a")]), owners(), objects, "epoch");
  assert.match(output.tracks[0]!.label, /^Source \d+$/);
  assert.notEqual(output.tracks[0]!.label, "Rubber ball");
});

test("clear releases associations and arrays without abandoning the bounded owned objects", () => {
  const projection = new LiveMonitorLabelProjection();
  const first = projection.project(frame([track("a")]), owners(["a", "ball"]), objects, "epoch");
  const ownArray = first.tracks;
  projection.clear();
  assert.equal(ownArray.length, 0);
  assert.equal(first.waveform, null);
  assert.equal(first.spectrumDbfs, null);
  const next = projection.project(frame([track("a")]), owners(), objects, "epoch");
  assert.strictEqual(next, first);
  assert.strictEqual(next.tracks, ownArray);
  assert.match(next.tracks[0]!.label, /^Source \d+$/);
});

test("epoch reset rejects old owner associations even for same IDs and published array", () => {
  const projection = new LiveMonitorLabelProjection();
  projection.project(frame([track("a")]), owners(["a", "ball"]), objects, "before");
  const output = projection.project(frame([track("a")]), owners(), objects, "after");
  assert.match(output.tracks[0]!.label, /^Source \d+$/);
});

test("first-seen fading and malformed-looking instance text never imply a guessed object owner", () => {
  const projection = new LiveMonitorLabelProjection();
  const output = projection.project(
    frame([track("voice.ball.speaker")]),
    owners(),
    objects,
    "epoch",
  );
  assert.match(output.tracks[0]!.label, /^Source \d+$/);
  assert.equal(output.tracks[0]!.id, "voice.ball.speaker");
  assert.equal(output.tracks[0]!.sourceId, "source.voice.ball.speaker");
});

test("object names absent from the published projection use its trusted object ID fallback", () => {
  const projection = new LiveMonitorLabelProjection();
  const output = projection.project(
    frame([track("a")]),
    owners(["a", "ball"]),
    [{ id: "ball" }],
    "epoch",
  );
  assert.equal(output.tracks[0]!.label, "ball");
});

test("kind distinguishes master IDs from sources and reused slots clear missing optional fields", () => {
  const projection = new LiveMonitorLabelProjection();
  const first = projection.project(
    frame([track("same", "output"), track("same")]),
    owners(["same", "ball"]),
    objects,
    "epoch",
  );
  assert.notStrictEqual(first.tracks[0], first.tracks[1]);
  assert.equal(first.tracks[0]!.label, "same");
  assert.equal(first.tracks[1]!.label, "Rubber ball");
  const replacement = track("new");
  delete replacement.sourceId;
  delete replacement.instanceId;
  const next = projection.project(frame([replacement]), owners(), objects, "epoch");
  assert.equal("sourceId" in next.tracks[0]!, false);
  assert.equal("instanceId" in next.tracks[0]!, false);
});

test("capacity stays at eight owned track objects over many native lifetimes", () => {
  const projection = new LiveMonitorLabelProjection();
  const identities = new Set<LiveAudioMonitorTrack>();
  for (let tick = 0; tick < 100; tick++) {
    const raw = frame(Array.from({ length: 10 }, (_, index) => track(`voice.${tick}.${index}`)));
    const output = projection.project(raw, owners(), objects, "epoch");
    assert.equal(output.tracks.length, 8);
    for (const item of output.tracks) identities.add(item);
    assert.equal(output.unmeasuredVirtualVoices, raw.unmeasuredVirtualVoices);
    assert.equal(output.tapNodeCount, raw.tapNodeCount);
  }
  assert.ok(identities.size <= 8);
});
