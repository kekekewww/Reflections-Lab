import test from "node:test";
import assert from "node:assert/strict";
import type { LabAction, LabController, LabViewModel, SoundRuleOverride } from "./contracts.js";
import {
  applyBindingDraft,
  createBindingDraft,
  normalizeBindingOverride,
  validateBindingDraft,
  type BindingDraftEntry,
} from "./binding-drafts.js";

function snapshot(override: SoundRuleOverride | null = null): LabViewModel {
  const base = { enabled: true, gainLinear: 0.1, pitchSemitones: 0 };
  return {
    projectId: "project.1",
    projectName: "覆寫驗證",
    sceneRevision: 3,
    workspace: "scene",
    simulationState: "paused",
    interactionMode: "editor",
    tick: 0,
    simTimeSeconds: 0,
    runId: null,
    objects: [],
    selectedObjectId: "ball",
    listener: {
      id: "listener",
      attachment: "independent",
      positionM: [0, 1.6, 0],
      orientationQuaternion: [0, 0, 0, 1],
    },
    paths: [],
    events: [],
    assets: [],
    behaviors: [
      {
        objectId: "ball",
        profileId: "profile.shared",
        revision: 4,
        presetKind: "creative",
        bindingId: "binding.ball",
        bindingEnabled: true,
        documentRevision: 7,
        rules: [
          {
            id: "rule.impact",
            trigger: "OnImpact",
            generator: "oscillator",
            enabled: override?.enabled ?? base.enabled,
            gainLinear: override?.gainLinear ?? base.gainLinear,
            pitchSemitones: override?.pitchSemitones ?? base.pitchSemitones,
            cooldownSeconds: 0.08,
            baseValues: base,
            bindingOverride: override,
          },
        ],
      },
    ],
    monitor: {
      state: "muted",
      muted: true,
      gainLinear: 0.1,
      mode: "simulated",
      activeVoices: 0,
      voiceLimit: 16,
    },
    recording: { state: "idle", eventCount: 0, durationSeconds: 0, canReplay: false },
    ai: { mode: "offline", status: "idle", message: "", canApply: false },
    comparison: { hasA: false, hasB: false, status: "", metrics: [] },
    acoustic: { backend: "test", model: "test", revision: null, state: "pending", metrics: [] },
    canUndo: false,
    canRedo: false,
  };
}

function draft(initial: LabViewModel = snapshot()): BindingDraftEntry {
  const behavior = initial.behaviors[0]!;
  return createBindingDraft(initial, behavior, behavior.rules[0]!);
}

function acknowledge(initial: LabViewModel, override: SoundRuleOverride | null): LabViewModel {
  const next = structuredClone(initial);
  const behavior = next.behaviors[0]!;
  const rule = behavior.rules[0]!;
  behavior.documentRevision = behavior.documentRevision! + 1;
  rule.bindingOverride = override;
  rule.enabled = behavior.bindingEnabled! && (override?.enabled ?? rule.baseValues!.enabled);
  rule.gainLinear = override?.gainLinear ?? rule.baseValues!.gainLinear;
  rule.pitchSemitones = override?.pitchSemitones ?? rule.baseValues!.pitchSemitones;
  next.lastBehaviorEdit = {
    objectId: behavior.objectId,
    bindingId: behavior.bindingId!,
    beforeDocumentRevision: 7,
    afterDocumentRevision: 8,
    beforeProfileId: behavior.profileId,
    afterProfileId: behavior.profileId,
    afterProfileRevision: behavior.revision,
  };
  return next;
}

function host(initial: LabViewModel, dispatch: (action: LabAction) => void | Promise<void>) {
  let current = initial;
  return {
    controller: {
      getSnapshot: () => current,
      subscribe: () => () => {},
      getPose: () => undefined,
      dispatch,
    } satisfies LabController,
    replace: (value: LabViewModel) => {
      current = value;
    },
  };
}

test("drafts pin real metadata and distinguish omitted inheritance from explicit false and zero", () => {
  const initial = snapshot({ enabled: false, gainLinear: 0 });
  const value = draft(initial);
  assert.equal(value.projectKey, "project.1");
  assert.equal(value.expectedSceneRevision, 3);
  assert.equal(value.expectedBehaviorRevision, 7);
  assert.equal(value.profileRevision, 4);
  assert.deepEqual(value.fields, { enabled: true, gainLinear: true, pitchSemitones: false });
  assert.deepEqual(value.values, { enabled: false, gainLinear: "0", pitchSemitones: "0" });
  assert.deepEqual(validateBindingDraft(value), {
    override: { enabled: false, gainLinear: 0 },
    errors: [],
  });
  assert.deepEqual(normalizeBindingOverride({}), null);
});

test("partial overrides replace selected fields and unchecked invalid raw values inherit", () => {
  const value = draft(snapshot({ enabled: false, pitchSemitones: 2 }));
  value.fields = { enabled: false, gainLinear: true, pitchSemitones: false };
  value.values.gainLinear = "0.25";
  value.values.pitchSemitones = "unfinished";
  assert.deepEqual(validateBindingDraft(value), { override: { gainLinear: 0.25 }, errors: [] });
  value.fields.gainLinear = false;
  assert.deepEqual(validateBindingDraft(value), { override: null, errors: [] });
});

test("invalid or out-of-schema numeric drafts cannot send a previous valid value", async () => {
  let calls = 0;
  const runtime = host(snapshot(), () => {
    calls += 1;
  });
  for (const raw of ["", " ", "NaN", "Infinity", "1e", "-0.001", "4.00001"]) {
    const value = draft();
    value.fields.gainLinear = true;
    value.values.gainLinear = raw;
    await assert.rejects(applyBindingDraft(runtime.controller, value), /DRAFT_INVALID/);
    assert.equal(value.values.gainLinear, raw);
  }
  const pitch = draft();
  pitch.fields.pitchSemitones = true;
  pitch.values.pitchSemitones = "24.01";
  await assert.rejects(applyBindingDraft(runtime.controller, pitch), /DRAFT_INVALID/);
  assert.equal(calls, 0);
});

test("missing base or revision metadata never fabricates an inheritance editor", () => {
  const initial = snapshot();
  const behavior = initial.behaviors[0]!;
  delete behavior.rules[0]!.baseValues;
  assert.throws(() => draft(initial), /METADATA_UNAVAILABLE/);
  const next = snapshot();
  delete next.behaviors[0]!.documentRevision;
  assert.throws(() => draft(next), /METADATA_UNAVAILABLE/);
});

test("pinned project, scene, document, binding, profile and baseline values refuse stale dispatch", async () => {
  const mutations: ((value: LabViewModel) => void)[] = [
    (value) => {
      value.projectId = "project.replaced";
    },
    (value) => {
      value.sceneRevision++;
    },
    (value) => {
      value.behaviors[0]!.documentRevision!++;
    },
    (value) => {
      value.behaviors[0]!.bindingId = "binding.replaced";
    },
    (value) => {
      value.behaviors[0]!.profileId = "profile.replaced";
    },
    (value) => {
      value.behaviors[0]!.revision++;
    },
    (value) => {
      value.behaviors[0]!.rules[0]!.bindingOverride = { gainLinear: 0.9 };
    },
    (value) => {
      value.behaviors[0]!.rules[0]!.baseValues!.gainLinear = 0.9;
    },
  ];
  for (const mutate of mutations) {
    const initial = snapshot();
    const value = draft(initial);
    const changed = structuredClone(initial);
    mutate(changed);
    let calls = 0;
    const runtime = host(changed, () => {
      calls++;
    });
    await assert.rejects(applyBindingDraft(runtime.controller, value), /STALE_BINDING/);
    assert.equal(calls, 0);
  }
});

test("ambiguous object rules cannot select a binding by array position", async () => {
  const initial = snapshot();
  const value = draft(initial);
  initial.behaviors.push(structuredClone(initial.behaviors[0]!));
  const runtime = host(initial, () => assert.fail("ambiguous binding must not dispatch"));
  await assert.rejects(applyBindingDraft(runtime.controller, value), /BINDING_MISSING/);
});

test("rejected promises and domain errors preserve the caller's entire raw draft", async () => {
  const value = draft();
  value.fields.gainLinear = true;
  value.values.gainLinear = "0.35";
  const original = structuredClone(value);
  const rejected = host(snapshot(), () => Promise.reject(new Error("REJECTED")));
  await assert.rejects(applyBindingDraft(rejected.controller, value), /REJECTED/);
  const failed = host(snapshot(), () => {
    failed.replace({ ...acknowledge(snapshot(), { gainLinear: 0.35 }), error: "DOMAIN_REJECTED" });
  });
  await assert.rejects(applyBindingDraft(failed.controller, value), /DOMAIN_REJECTED/);
  assert.deepEqual(value, original);
});

test("fulfilled dispatch without the matching receipt cannot clear the draft", async () => {
  const value = draft();
  value.fields.gainLinear = true;
  value.values.gainLinear = "0.35";
  const missing = host(snapshot(), () => {});
  await assert.rejects(applyBindingDraft(missing.controller, value), /ACK_MISSING/);
  const unsigned = host(snapshot(), () => {
    const next = acknowledge(snapshot(), { gainLinear: 0.35 });
    delete next.lastBehaviorEdit;
    unsigned.replace(next);
  });
  await assert.rejects(applyBindingDraft(unsigned.controller, value), /ACK_MISSING/);
});

test("successful replacement sends only selected override fields and the original pinned versions", async () => {
  const initial = snapshot({ enabled: false, pitchSemitones: 3 });
  const value = draft(initial);
  value.fields = { enabled: false, gainLinear: true, pitchSemitones: false };
  value.values.gainLinear = "0.35";
  let action: LabAction | undefined;
  const runtime = host(initial, (next) => {
    action = next;
    runtime.replace(acknowledge(initial, { gainLinear: 0.35 }));
  });
  await applyBindingDraft(runtime.controller, value);
  assert.deepEqual(action, {
    type: "setBindingOverride",
    objectId: "ball",
    ruleId: "rule.impact",
    override: { gainLinear: 0.35 },
    expectedSceneRevision: 3,
    expectedBehaviorRevision: 7,
  });
  assert.equal(runtime.controller.getSnapshot().behaviors[0]!.revision, 4);
});

test("clear is explicit null and acknowledges the inherited base values without a profile change", async () => {
  const initial = snapshot({ enabled: false, gainLinear: 0.8, pitchSemitones: 2 });
  const value = draft(initial);
  value.fields = { enabled: false, gainLinear: false, pitchSemitones: false };
  let action: LabAction | undefined;
  const runtime = host(initial, (next) => {
    action = next;
    runtime.replace(acknowledge(initial, null));
  });
  await applyBindingDraft(runtime.controller, value);
  assert.deepEqual(
    action && action.type === "setBindingOverride" ? action.override : "wrong action",
    null,
  );
  assert.equal(runtime.controller.getSnapshot().behaviors[0]!.rules[0]!.gainLinear, 0.1);
  assert.equal(runtime.controller.getSnapshot().behaviors[0]!.profileId, "profile.shared");
});

test("an enabled rule override never bypasses the binding gate", async () => {
  const initial = snapshot();
  initial.behaviors[0]!.bindingEnabled = false;
  initial.behaviors[0]!.rules[0]!.enabled = false;
  const value = draft(initial);
  value.fields.enabled = true;
  value.values.enabled = true;
  const runtime = host(initial, () => {
    runtime.replace(acknowledge(initial, { enabled: true }));
  });
  await applyBindingDraft(runtime.controller, value);
  assert.equal(runtime.controller.getSnapshot().behaviors[0]!.rules[0]!.enabled, false);
  assert.equal(runtime.controller.getSnapshot().behaviors[0]!.bindingEnabled, false);
});

test("receipt mismatch, changed profile or stale effective values reject a false acknowledgement", async () => {
  const value = draft();
  value.fields.gainLinear = true;
  value.values.gainLinear = "0.35";
  const mutations: ((next: LabViewModel) => void)[] = [
    (next) => {
      next.lastBehaviorEdit!.bindingId = "other";
    },
    (next) => {
      next.behaviors[0]!.revision++;
    },
    (next) => {
      next.behaviors[0]!.profileId = "different";
    },
    (next) => {
      next.behaviors[0]!.documentRevision = 9;
    },
    (next) => {
      next.behaviors[0]!.rules[0]!.gainLinear = 0.1;
    },
  ];
  for (const mutate of mutations) {
    const runtime = host(snapshot(), () => {
      const next = acknowledge(snapshot(), { gainLinear: 0.35 });
      mutate(next);
      runtime.replace(next);
    });
    await assert.rejects(applyBindingDraft(runtime.controller, value), /ACK_MISSING/);
  }
});

test("the actual original promise must settle before an otherwise matching acknowledgement", async () => {
  const value = draft();
  value.fields.gainLinear = true;
  value.values.gainLinear = "0.35";
  const original = structuredClone(value);
  let finish: (() => void) | undefined;
  const runtime = host(
    snapshot(),
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let resolved = false;
  const pending = applyBindingDraft(runtime.controller, value).then(() => {
    resolved = true;
  });
  runtime.replace(acknowledge(snapshot(), { gainLinear: 0.35 }));
  await Promise.resolve();
  assert.equal(resolved, false);
  assert.ok(finish);
  finish();
  await pending;
  assert.equal(resolved, true);
  assert.deepEqual(value, original);
});

test("a replacement project cannot acknowledge an older project's override transaction", async () => {
  const value = draft();
  value.fields.gainLinear = true;
  value.values.gainLinear = "0.35";
  const runtime = host(snapshot(), () => {
    const replaced = acknowledge(snapshot(), { gainLinear: 0.35 });
    replaced.projectId = "project.replaced-during-await";
    runtime.replace(replaced);
  });
  await assert.rejects(applyBindingDraft(runtime.controller, value), /ACK_MISSING/);
});

test("caller edits during an asynchronous transaction cannot change its pinned acknowledgement", async () => {
  const value = draft();
  value.fields.gainLinear = true;
  value.values.gainLinear = "0.35";
  let finish: (() => void) | undefined;
  const runtime = host(
    snapshot(),
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = applyBindingDraft(runtime.controller, value);
  value.expectedBehaviorRevision = 99;
  value.values.gainLinear = "0.9";
  value.baselineBaseValues.gainLinear = 3;
  runtime.replace(acknowledge(snapshot(), { gainLinear: 0.35 }));
  assert.ok(finish);
  finish();
  await pending;
  assert.equal(value.expectedBehaviorRevision, 99);
  assert.equal(value.values.gainLinear, "0.9");
});
