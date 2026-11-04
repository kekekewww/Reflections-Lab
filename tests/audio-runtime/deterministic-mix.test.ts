import assert from "node:assert/strict";
import test from "node:test";
import {
  DeterministicMixInput,
  type DeterministicMixHandle,
} from "../../src/audio/deterministic-mix.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { AudioEngineError, type AcousticFrame, type VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext, FakeGainNode, type FakeNode } from "./fake-context.js";
import { ROUTE_FADE_SECONDS, ROUTE_RETIRE_TAIL_SECONDS } from "../../src/audio/routes.js";

const routeRelease = ROUTE_FADE_SECONDS + ROUTE_RETIRE_TAIL_SECONDS;

// Graph/lifecycle evidence only; this fake does not render native PCM.
const audioNode = (node: FakeNode) => node as unknown as AudioNode;
const inputs = (context: FakeAudioContext, node: FakeNode) =>
  context.nodes.filter((source) => source.connections.includes(node));

/** Discover from the target, independently of the bus's slot bookkeeping. */
function assertBus(context: FakeAudioContext, target: FakeNode, leaves: FakeNode[]): FakeNode[] {
  const roots = inputs(context, target);
  assert.equal(roots.length, 1, "only J0 feeds the original target");
  const leafSet = new Set(leaves);
  const found = new Set<FakeNode>();
  const junctions: FakeNode[] = [];
  let junction = roots[0];
  while (junction) {
    assert.ok(!junctions.includes(junction), "junction chain is acyclic");
    junctions.push(junction);
    assert.ok(junction instanceof FakeGainNode);
    assert.equal(junction.gain.value, 1);
    assert.equal(junction.gain.automation.length, 0);
    const incoming = inputs(context, junction);
    assert.ok(incoming.length <= 2, "each junction has at most two inputs");
    const attached = incoming.filter((node) => leafSet.has(node));
    assert.ok(attached.length <= 1, "at most one leaf per slot");
    for (const leaf of attached) {
      assert.ok(!found.has(leaf));
      found.add(leaf);
    }
    const successors = incoming.filter((node) => !leafSet.has(node));
    assert.ok(successors.length <= 1, "at most one successor per junction");
    junction = successors[0];
  }
  assert.equal(found.size, leafSet.size, "every expected leaf reaches the target once");
  return junctions;
}

/** Replay every individual graph mutation, including intermediate growth states. */
function assertBoundedHistory(context: FakeAudioContext, nodes: FakeNode[]): void {
  const edges = new Map<FakeNode, Set<FakeNode>>();
  for (const call of context.graphCalls) {
    const outgoing = edges.get(call.source) ?? new Set<FakeNode>();
    edges.set(call.source, outgoing);
    if (call.method === "connect") outgoing.add(call.destination!);
    else if (call.destination) outgoing.delete(call.destination);
    else outgoing.clear();
    for (const node of nodes) {
      const count = [...edges.values()].filter((targets) => targets.has(node)).length;
      assert.ok(count <= 2, `node ${node.id} had ${count} inputs during ${call.method}`);
    }
  }
}

test("256 leaves use unity two-input junctions and growth never disconnects a link", () => {
  const context = new FakeAudioContext();
  const target = context.createGain();
  const leaves = Array.from({ length: 256 }, () => context.createGain());
  const bus = new DeterministicMixInput(context.asContext(), audioNode(target), 256);
  const before = context.nodes.length;
  for (const leaf of leaves) bus.attach(audioNode(leaf));
  const junctions = assertBus(context, target, leaves);
  assert.equal(junctions.length, 256);
  assert.equal(context.nodes.length - before, 255, "one new junction per additional peak leaf");
  for (let slot = 0; slot < leaves.length; slot++)
    assert.deepEqual(leaves[slot]!.connections, [junctions[slot]]);
  assert.equal(context.graphCalls.filter((call) => call.method === "disconnect").length, 0);
  assertBoundedHistory(context, [target, ...junctions]);
  bus.dispose();
});

test("lowest-free-slot reuse is deterministic across fresh graphs and unrelated allocations", () => {
  function sequence(noise: number): number[] {
    const context = new FakeAudioContext();
    for (let i = 0; i < noise; i++) context.createGain();
    const target = context.createGain();
    const leaves = Array.from({ length: 9 }, () => context.createGain());
    const bus = new DeterministicMixInput(context.asContext(), audioNode(target));
    const handles = leaves.slice(0, 5).map((leaf) => bus.attach(audioNode(leaf)));
    const chain = assertBus(context, target, leaves.slice(0, 5));
    const slots = leaves.slice(0, 5).map((leaf) => chain.indexOf(leaf.connections[0]!));
    bus.detach(handles[3]!);
    bus.detach(handles[1]!);
    for (const index of [5, 6]) {
      handles[index] = bus.attach(audioNode(leaves[index]!));
      slots.push(chain.indexOf(leaves[index]!.connections[0]!));
    }
    bus.detach(handles[0]!);
    handles[7] = bus.attach(audioNode(leaves[7]!));
    slots.push(chain.indexOf(leaves[7]!.connections[0]!));
    bus.attach(audioNode(leaves[8]!));
    const expanded = assertBus(
      context,
      target,
      [2, 4, 5, 6, 7, 8].map((i) => leaves[i]!),
    );
    slots.push(expanded.indexOf(leaves[8]!.connections[0]!));
    assert.deepEqual(expanded.slice(0, 5), chain, "existing junction identities never change");
    assert.ok(
      context.graphCalls
        .filter((call) => call.method === "disconnect")
        .every((call) => leaves.includes(call.source as FakeGainNode)),
      "reuse must never disconnect a junction link",
    );
    bus.dispose();
    return slots;
  }
  assert.deepEqual(sequence(0), [0, 1, 2, 3, 4, 1, 3, 0, 5]);
  assert.deepEqual(sequence(37), sequence(0));
});

test("detach removes exactly its leaf link, preserves other outputs, and ignores stale handles", () => {
  const context = new FakeAudioContext();
  const target = context.createGain();
  const tap = context.createGain();
  const leaf = context.createGain();
  leaf.connect(tap);
  const bus = new DeterministicMixInput(context.asContext(), audioNode(target));
  const first = bus.attach(audioNode(leaf));
  const second = bus.attach(audioNode(leaf));
  const [slot0, slot1] = leaf.connections.filter((node) => node !== tap);
  const before = context.graphCalls.length;
  bus.detach(first);
  assert.deepEqual(context.graphCalls.slice(before), [
    { method: "disconnect", source: leaf, destination: slot0 },
  ]);
  assert.deepEqual(leaf.connections, [tap, slot1]);
  bus.detach(first);
  assert.equal(context.graphCalls.length, before + 1);
  const reused = bus.attach(audioNode(leaf));
  bus.detach(first);
  assert.ok(leaf.connections.includes(slot0!));
  bus.detach(second);
  bus.detach(reused);
  assert.deepEqual(leaf.connections, [tap]);
  bus.dispose();
});

test("dispose disconnects every owned leaf and junction once and rejects further attachment", () => {
  const context = new FakeAudioContext();
  const target = context.createGain();
  target.connect(context.destination);
  const leaves = Array.from({ length: 4 }, () => context.createGain());
  const bus = new DeterministicMixInput(context.asContext(), audioNode(target));
  const handles = leaves.map((leaf) => bus.attach(audioNode(leaf)));
  const junctions = assertBus(context, target, leaves);
  bus.detach(handles[1]!);
  const before = context.graphCalls.length;
  bus.dispose();
  const calls = context.graphCalls.slice(before);
  assert.equal(calls.length, 3 + 4);
  for (const node of [...leaves.filter((_, i) => i !== 1), ...junctions])
    assert.equal(calls.filter((call) => call.source === node).length, 1);
  assert.ok([...leaves, ...junctions].every((node) => node.connections.length === 0));
  assert.deepEqual(target.connections, [context.destination], "bus does not own the target");
  bus.dispose();
  bus.detach(handles[0]!);
  assert.equal(context.graphCalls.length, before + calls.length);
  assert.throws(() => bus.attach(audioNode(leaves[0]!)), { code: "MIX_DISPOSED" });
});

test("invalid capacities and exhausted capacity fail explicitly without graph mutations", () => {
  const context = new FakeAudioContext();
  const target = context.createGain();
  for (const cap of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => new DeterministicMixInput(context.asContext(), audioNode(target), cap), {
      code: "INVALID_MIX_CAPACITY",
    });
  const bus = new DeterministicMixInput(context.asContext(), audioNode(target), 2);
  const leaves = Array.from({ length: 3 }, () => context.createGain());
  const first = bus.attach(audioNode(leaves[0]!));
  bus.attach(audioNode(leaves[1]!));
  const before = context.graphCalls.length;
  assert.throws(
    () => bus.attach(audioNode(leaves[2]!)),
    (error: unknown) => {
      assert.ok(error instanceof AudioEngineError);
      assert.equal(error.code, "MIX_CAPACITY");
      return true;
    },
  );
  assert.equal(context.graphCalls.length, before);
  bus.detach(first);
  bus.attach(audioNode(leaves[2]!));
  assertBus(context, target, leaves.slice(1));
  bus.dispose();
});

class OfflineContext extends FakeAudioContext {
  async startRendering(): Promise<AudioBuffer> {
    throw new Error("Graph fixture must not render");
  }
}

function frame(sourceId: string, generation = 0): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: `${sourceId}-${generation}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: generation,
    backendId: "deterministic-mix-control-fixture",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters", "individualReflectionPaths"],
    modelClass: "numericalApproximation",
    directDelayS: 0.01,
    paths: Array.from({ length: 4 }, (_, index) => ({
      id: `${sourceId}-path-${generation}-${index}`,
      sourceId,
      listenerId: "listener",
      surfaceIds: [],
      order: index,
      verticesM: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      lengthM: 1,
      absoluteDelayS: 0.01,
      relativeDelayS: 0,
      arrivalDirection: [1, 0, 0],
      bandGains: [0.25],
    })),
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["GRAPH_ONLY_NOT_NATIVE_PCM"],
  };
}

function voice(index: number, generation = 0): VoiceInput {
  return {
    instanceId: `voice-${index}-${generation}`,
    sourceId: `source-${index}`,
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
    gainLinear: 0.2,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
  };
}

interface RouteView {
  panner: FakeNode;
}
interface VoiceView {
  envelope: FakeGainNode;
  renderGate: FakeGainNode | null;
  rawMixHandle: DeterministicMixHandle | null;
  routes: Map<string, RouteView>;
  lateRoute: RouteView | null;
}
interface EngineGraph {
  rawMix: FakeGainNode;
  simulatedMix: FakeGainNode;
  lateBus: { input: FakeGainNode; wet: FakeGainNode };
  phaseAnchor: FakeGainNode | null;
  voices: Map<string, VoiceView>;
  retiring: Set<VoiceView>;
  retiredRoutes: Set<RouteView>;
  retiredLateRoutes: Set<RouteView>;
}

for (const oscillatorModel of ["nativeReference", "nativeCarrierRoutes"] as const)
  test(`${oscillatorModel}: N voices x M paths retain bounded bus inputs through retirement and replacement`, async () => {
    const context = new OfflineContext();
    const engine = new AudioEngine({
      context: context.asContext(),
      oscillatorModel,
      budget: { maxVoices: 12, maxPathsPerVoice: 4, maxTotalPaths: 128, maxLateSends: 24 },
    });
    const graph = engine as unknown as EngineGraph;
    await engine.enable(0);
    engine.setLateReverb({ enabled: true, decaySeconds: 0.1 });
    const n = 6;
    const roots = [graph.rawMix, graph.simulatedMix, graph.lateBus.input].map(
      (node) => inputs(context, node)[0]!,
    );
    const allJunctions = new Set<FakeNode>();
    const verify = () => {
      const voices = [...graph.voices.values(), ...graph.retiring];
      const raw = voices.filter((v) => v.rawMixHandle).map((v) => v.renderGate ?? v.envelope);
      const simulated = [
        graph.lateBus.wet,
        ...voices.flatMap((v) => [...v.routes.values()].map((r) => r.panner)),
        ...[...graph.retiredRoutes]
          .filter((r) => !graph.retiredLateRoutes.has(r))
          .map((r) => r.panner),
      ];
      const late = [
        ...voices.flatMap((v) => (v.lateRoute ? [v.lateRoute.panner] : [])),
        ...[...graph.retiredLateRoutes].map((r) => r.panner),
      ];
      const buses: [FakeNode, FakeNode[]][] = [
        [graph.rawMix, raw],
        [graph.simulatedMix, simulated],
        [graph.lateBus.input, late],
      ];
      for (const [index, [target, leaves]] of buses.entries()) {
        const junctions = assertBus(context, target, leaves);
        assert.equal(junctions[0], roots[index], "root connection never changes");
        for (const junction of junctions) allJunctions.add(junction);
      }
      return { raw, simulated, late };
    };
    try {
      for (let i = 0; i < n; i++) {
        const input = voice(i);
        assert.equal(engine.playVoice(input, frame(input.sourceId)).accepted, true);
        verify();
      }
      const initial = verify();
      assert.equal(initial.raw.length, n);
      assert.equal(initial.simulated.length, n * 4 + 1);
      assert.equal(initial.late.length, n);
      for (let round = 1; round <= 3; round++) {
        const oldPanners = context.panners().filter((node) => node.connections.length > 0);
        for (let i = 0; i < n; i++) engine.updateFrame(frame(`source-${i}`, round));
        assert.equal(verify().simulated.length, n * 8 + 1, "old paths survive their fade");
        context.currentTime += routeRelease - 1 / context.sampleRate;
        engine.flushControlUpdates();
        assert.ok(oldPanners.every((node) => node.connections.length > 0));
        verify();
        context.currentTime += 1 / context.sampleRate;
        engine.flushControlUpdates();
        assert.ok(oldPanners.every((node) => node.connections.length === 0));
        assert.equal(verify().simulated.length, n * 4 + 1);

        const outgoing = [...graph.voices.values()];
        for (let i = 0; i < n; i++) {
          engine.stopVoice(voice(i, round - 1).instanceId);
          const replacement = voice(i, round);
          assert.equal(
            engine.playVoice(replacement, frame(replacement.sourceId, round)).accepted,
            true,
          );
        }
        assert.equal(verify().raw.length, n * 2, "retiring dry voices stay attached");
        context.currentTime += 0.05 - 1 / context.sampleRate;
        engine.flushControlUpdates();
        assert.ok(outgoing.every((v) => v.rawMixHandle !== null));
        verify();
        context.currentTime += 1 / context.sampleRate;
        engine.flushControlUpdates();
        assert.ok(outgoing.every((v) => v.rawMixHandle === null));
        assert.equal(verify().raw.length, n);
      }
      const junctionCount = allJunctions.size;
      for (let i = 0; i < n; i++) engine.stopVoice(voice(i, 3).instanceId);
      context.currentTime += 0.1;
      engine.flushControlUpdates();
      const empty = verify();
      assert.equal(empty.raw.length, 0);
      assert.equal(empty.simulated.length, 1, "late wet remains connected for its bus lifetime");
      assert.equal(empty.late.length, 0);
      assert.equal(allJunctions.size, junctionCount);
      assert.ok(
        context.graphCalls
          .filter((call) => call.method === "disconnect")
          .every((call) => !allJunctions.has(call.source)),
        "no junction links are disconnected while the engine runs",
      );
      assertBoundedHistory(context, [
        graph.rawMix,
        graph.simulatedMix,
        graph.lateBus.input,
        ...allJunctions,
      ]);
      if (graph.phaseAnchor) {
        assert.equal(graph.phaseAnchor.gain.value, 0);
        assert.equal(graph.phaseAnchor.gain.automation.length, 0);
      }
    } finally {
      engine.dispose();
    }
    assert.ok(context.nodes.every((node) => node.connections.length === 0));
  });
