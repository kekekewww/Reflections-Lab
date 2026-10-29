import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import type {
  BehaviorFrame,
  BehaviorRuntime,
  BehaviorStepResult,
} from "../../src/audio-behavior/types.js";
import * as F from "./fixtures.js";

type Pair = readonly [BehaviorRuntime, BehaviorRuntime];
const clone = structuredClone;
const projectFullSnapshot = (runtime: BehaviorRuntime) =>
  runtime.snapshot().state.bindings.map(({ bindingId, activeRuleIds }) => ({
    bindingId,
    activeRuleIds,
  }));

function pair(document = F.document(), context = F.context(), options = F.options): Pair {
  return [
    createBehaviorRuntime(clone(document), clone(context), clone(options)),
    createBehaviorRuntime(clone(document), clone(context), clone(options)),
  ];
}

function equal([reference, actual]: Pair, label: string): void {
  assert.deepEqual(actual.getActiveRuleStates(), projectFullSnapshot(reference), `${label}: rules`);
  assert.deepEqual(actual.snapshot(), reference.snapshot(), `${label}: full snapshot`);
  assert.deepEqual(actual.getTrace(), reference.getTrace(), `${label}: trace`);
  for (const state of actual.getActiveRuleStates()) {
    assert.deepEqual(Object.keys(state), ["bindingId", "activeRuleIds"]);
  }
}

function step(runtimes: Pair, input: BehaviorFrame): BehaviorStepResult {
  const expected = runtimes[0].step(clone(input));
  const actual = runtimes[1].step(clone(input));
  assert.deepEqual(actual, expected, "step output");
  equal(runtimes, "step");
  return actual;
}

function alter(runtimes: Pair, operation: (runtime: BehaviorRuntime) => void, label: string): void {
  operation(runtimes[0]);
  operation(runtimes[1]);
  equal(runtimes, label);
}

function rejected(runtimes: Pair, operation: (runtime: BehaviorRuntime) => void, code?: string) {
  const errors = runtimes.map((runtime) => {
    let caught: unknown;
    try {
      operation(runtime);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof Error, "bounded rejection required");
    return {
      name: caught.name,
      code: "code" in caught ? caught.code : undefined,
      message: caught.message,
    };
  });
  assert.deepEqual(errors[1], errors[0]);
  if (code) assert.equal(errors[1]!.code, code);
  equal(runtimes, "rejected operation");
  return errors[1]!;
}

const moving = (value: boolean) => {
  const object = F.object();
  object.states.moving = value;
  return object;
};
const latch = () =>
  F.rule({
    ruleId: "rule.flight",
    trigger: { kind: "discrete", type: "OnThrow" },
    lifecycle: {
      mode: "latched",
      stopOn: ["OnImpact"],
      retriggerPolicy: "ignore",
      maxDurationSeconds: 1,
    },
  });
const thrown = (tick: number) =>
  F.event({
    eventId: `command.throw.${tick}`,
    tick,
    type: "OnThrow",
    source: "interaction",
    commandId: `command.${tick}`,
  });

test("active-rule projection matches initial and empty state without changing the full snapshot method", () => {
  const source = readFileSync(
    new URL("../../src/audio-behavior/index.ts", import.meta.url),
    "utf8",
  );
  const snapshotMethod = source.slice(
    source.indexOf("    snapshot() {"),
    source.indexOf("    restore(snapshot) {"),
  );
  assert.equal(Buffer.byteLength(snapshotMethod), 297);
  assert.equal(
    createHash("sha256").update(snapshotMethod).digest("hex"),
    "81e373cd330c6a18f2d42da68edce6ed8d284640eef22247b50c83d3bea33ac4",
    "original detached full snapshot remains the recording/restore authority",
  );
  for (const empty of [false, true]) {
    const document = F.document();
    if (empty) document.bindings = [];
    const runtimes = pair(document);
    equal(runtimes, "initial");
    assert.equal(runtimes[1].getActiveRuleStates().length, empty ? 0 : 1);
  }
});

test("active-rule projection preserves shared-profile binding and rule order, including restored order", () => {
  const document = F.document([F.rule({ ruleId: "rule.a" }), F.rule({ ruleId: "rule.Z" })]);
  document.bindings = [
    { ...document.bindings[0]!, bindingId: "Binding.z" },
    { ...document.bindings[0]!, bindingId: "Binding.A" },
  ];
  const runtimes = pair(document);
  step(runtimes, F.frame());
  const saved = runtimes[0].snapshot();
  saved.state.bindings.reverse();
  for (const state of saved.state.bindings) state.activeRuleIds.reverse();
  alter(runtimes, (runtime) => runtime.restore(clone(saved)), "restore order");
  assert.deepEqual(
    runtimes[1].getActiveRuleStates().map((state) => state.bindingId),
    saved.state.bindings.map((state) => state.bindingId),
  );
});

test("continuous start, update, gate closure and fade cleanup keep projection and decisions identical", () => {
  const runtimes = pair(
    F.document([F.rule({ trigger: { kind: "continuous", type: "WhileMoving" } })]),
  );
  step(runtimes, F.frame(1, [], [moving(true)]));
  assert.deepEqual(runtimes[1].getActiveRuleStates()[0]!.activeRuleIds, ["rule.always"]);
  step(runtimes, F.frame(2, [], [moving(true)]));
  step(runtimes, F.frame(3, [], [moving(false)]));
  assert.deepEqual(runtimes[1].getActiveRuleStates()[0]!.activeRuleIds, []);
  step(runtimes, F.frame(4, [], [moving(false)]));
  assert.equal(runtimes[1].snapshot().state.instances.length, 0);
});

test("one-shot deduplication, cooldown and lifetime keep existing active-rule semantics", () => {
  const runtimes = pair(F.document([F.impactRule({ cooldownSeconds: 0.21 })]));
  step(runtimes, F.frame(1, [F.event()]));
  assert.deepEqual(runtimes[1].getActiveRuleStates()[0]!.activeRuleIds, []);
  step(runtimes, F.frame(1, [F.event()]));
  step(runtimes, F.frame(3, [F.event({ eventId: "impact.cooldown", tick: 3 })]));
  step(runtimes, F.frame(4, [F.event({ eventId: "impact.rearmed", tick: 4 })]));
  step(runtimes, F.frame(12));
});

test("bounded latch start, retrigger, stop, deadline and positional updates keep projection identical", () => {
  const runtimes = pair(F.document([latch()]));
  step(runtimes, F.frame(1, [thrown(1)]));
  step(runtimes, F.frame(2, [thrown(2)], [F.object({ positionMetres: [4, 5, 6] })]));
  step(runtimes, F.frame(3, [F.event({ eventId: "impact.stop", tick: 3 })]));
  step(runtimes, F.frame(4));
  const timeout = pair(F.document([latch()]));
  step(timeout, F.frame(1, [thrown(1)]));
  step(timeout, F.frame(11));
  assert.deepEqual(timeout[1].getActiveRuleStates()[0]!.activeRuleIds, []);
});

test("finite priority admission and stealing expose authoritative active state", () => {
  const runtimes = pair(
    F.document([
      F.rule({ ruleId: "rule.low", priority: 10 }),
      F.impactRule({ ruleId: "rule.high", priority: 90 }),
    ]),
    F.context(),
    { ...F.options, maxVoices: 1, maxVoicesPerObject: 1 },
  );
  step(runtimes, F.frame(1));
  step(runtimes, F.frame(2, [F.event({ tick: 2 })]));
  assert.ok(
    runtimes[1].getTrace().some((entry) => entry.action === "stop" || entry.action === "reject"),
  );
  step(runtimes, F.frame(10));
});

test("known and unknown notifyEnded calls preserve active-rule state without reconstructing lifecycle", () => {
  const runtimes = pair();
  const started = step(runtimes, F.frame()).events.find((event) => event.action === "start")!;
  alter(runtimes, (runtime) => runtime.notifyEnded("instance.unknown"), "unknown ended");
  alter(runtimes, (runtime) => runtime.notifyEnded(started.instanceId), "known ended");
  assert.deepEqual(runtimes[1].getActiveRuleStates()[0]!.activeRuleIds, []);
  step(runtimes, F.frame(2));
});

test("projection containers are detached and retained values survive later lifecycle and reset", () => {
  const runtimes = pair();
  step(runtimes, F.frame());
  const runtime = runtimes[1];
  const before = runtime.snapshot();
  const trace = runtime.getTrace();
  const first = runtime.getActiveRuleStates();
  const retained = runtime.getActiveRuleStates();
  const saved = clone(retained);
  assert.notEqual(first, retained);
  assert.notEqual(first[0], retained[0]);
  assert.notEqual(first[0]!.activeRuleIds, retained[0]!.activeRuleIds);
  first[0]!.bindingId = "forged";
  first[0]!.activeRuleIds[0] = "forged";
  first[0]!.activeRuleIds.push("extra");
  first.push({ bindingId: "injected", activeRuleIds: [] });
  assert.deepEqual(runtime.snapshot(), before);
  assert.deepEqual(runtime.getTrace(), trace);
  equal(runtimes, "hostile returned-value mutation");
  alter(runtimes, (value) => value.notifyEnded(before.state.instances[0]!.instanceId), "ended");
  alter(runtimes, (value) => value.reset("epoch.detached"), "reset");
  assert.deepEqual(retained, saved);
});

test("repeated projection reads are pure initially, while paused, and during replacement epoch gate", () => {
  const runtimes = pair();
  for (const stage of ["initial", "paused", "epochGate"]) {
    if (stage === "paused") {
      step(runtimes, F.frame());
      alter(runtimes, (runtime) => runtime.setPaused(true), "pause");
      for (const runtime of runtimes) {
        for (const instance of runtime.snapshot().state.instances)
          runtime.notifyEnded(instance.instanceId);
      }
    }
    if (stage === "epochGate") {
      const replacement = F.document();
      replacement.revision = 1;
      alter(
        runtimes,
        (runtime) => runtime.replaceDocument(clone(replacement), F.context()),
        "replace",
      );
    }
    const before = runtimes[1].snapshot();
    const trace = runtimes[1].getTrace();
    for (let index = 0; index < 20; index++) equal(runtimes, `${stage}.${index}`);
    assert.deepEqual(runtimes[1].snapshot(), before);
    assert.deepEqual(runtimes[1].getTrace(), trace);
    if (stage === "epochGate") assert.equal(before.requiresNewEpoch, true);
  }
});

test("valid restore and stale or corrupted rejection keep projection tied to current full state", () => {
  const runtimes = pair();
  step(runtimes, F.frame());
  const saved = runtimes[0].snapshot();
  const retained = runtimes[1].getActiveRuleStates();
  step(runtimes, F.frame(2));
  alter(runtimes, (runtime) => runtime.restore(clone(saved)), "restore");
  assert.deepEqual(runtimes[1].getActiveRuleStates(), retained);
  const stale = clone(saved);
  stale.state.sceneRevision++;
  rejected(runtimes, (runtime) => runtime.restore(clone(stale)), "STALE_SNAPSHOT");
  const corrupt = clone(saved);
  corrupt.state.instances[0]!.gainLinear = Number.NaN;
  rejected(runtimes, (runtime) => runtime.restore(clone(corrupt)), "INVALID_SNAPSHOT");
});

test("reset and successful or rejected document replacement read newly assigned bindings", () => {
  const runtimes = pair();
  step(runtimes, F.frame());
  const retained = runtimes[1].getActiveRuleStates();
  const saved = clone(retained);
  const replacement = F.document([F.rule({ ruleId: "rule.new" })]);
  replacement.revision = 1;
  replacement.bindings[0]!.bindingId = "binding.NEW";
  rejected(
    runtimes,
    (runtime) => runtime.replaceDocument(clone(replacement), F.context()),
    "ACTIVE_VOICES_NOT_DRAINED",
  );
  alter(runtimes, (runtime) => runtime.reset("epoch.reset"), "reset");
  assert.deepEqual(runtimes[1].getActiveRuleStates()[0]!.activeRuleIds, []);
  const invalid = clone(replacement);
  invalid.bindings[0]!.profileId = "missing";
  rejected(runtimes, (runtime) => runtime.replaceDocument(clone(invalid), F.context()));
  alter(runtimes, (runtime) => runtime.replaceDocument(clone(replacement), F.context()), "replace");
  assert.equal(runtimes[1].snapshot().requiresNewEpoch, true);
  assert.equal(runtimes[1].getActiveRuleStates()[0]!.bindingId, "binding.NEW");
  alter(runtimes, (runtime) => runtime.reset("epoch.replacement"), "new epoch");
  step(runtimes, { ...F.frame(), runEpoch: "epoch.replacement" });
  assert.deepEqual(runtimes[1].getActiveRuleStates()[0]!.activeRuleIds, ["rule.new"]);
  assert.deepEqual(retained, saved);
});

test("bounded failure after active IDs mutate rolls back full state, trace and projection exactly", () => {
  const runtimes = pair(
    F.document([F.rule({ trigger: { kind: "continuous", type: "WhileMoving" } })]),
  );
  step(runtimes, F.frame(1, [], [moving(true)]));
  const maximumSequence = runtimes[0].snapshot();
  maximumSequence.state.sequence = 2147483647;
  alter(runtimes, (runtime) => runtime.restore(clone(maximumSequence)), "valid maximum sequence");
  const before = runtimes[1].snapshot();
  const trace = runtimes[1].getTrace();
  const retained = runtimes[1].getActiveRuleStates();
  assert.deepEqual(retained[0]!.activeRuleIds, ["rule.always"]);
  // Closing the gate mutates tick/playhead, playback and active IDs before emission overflows.
  const error = rejected(
    runtimes,
    (runtime) => runtime.step(F.frame(2, [], [moving(false)])),
    "NUMERIC_RANGE",
  );
  assert.equal(error.message, "audio sequence must be finite in [0, 2147483647]");
  assert.deepEqual(runtimes[1].snapshot(), before);
  assert.deepEqual(runtimes[1].getTrace(), trace);
  assert.deepEqual(runtimes[1].getActiveRuleStates(), retained);
  assert.equal(runtimes[1].snapshot().state.tick, 1);
  assert.equal(runtimes[1].snapshot().state.instances[0]!.playbackState, "playing");
});
