import test from "node:test";
import assert from "node:assert/strict";
import type {
  BehaviorRuleView,
  LabAction,
  LabController,
  LabViewModel,
  SoundParameterMapping,
} from "./contracts.js";
import {
  applyRuleDraft,
  editableRulePatch,
  ruleDraftKey,
  sameEditableRule,
  type RuleDraftEntry,
} from "./rule-drafts.js";

const original: BehaviorRuleView = {
  id: "rule.impact",
  trigger: "OnImpact",
  enabled: true,
  generator: "oscillator",
  gainLinear: 0.1,
  pitchSemitones: 0,
  cooldownSeconds: 0.08,
  mapping: "none",
};

function snapshot(rule: BehaviorRuleView = original, revision = 4): LabViewModel {
  return {
    projectName: "草稿驗證",
    sceneRevision: 1,
    workspace: "scene",
    simulationState: "paused",
    interactionMode: "editor",
    tick: 0,
    simTimeSeconds: 0,
    runId: null,
    objects: [],
    listener: {
      id: "listener",
      attachment: "independent",
      positionM: [0, 1.6, 0],
      orientationQuaternion: [0, 0, 0, 1],
    },
    selectedObjectId: "ball",
    paths: [],
    events: [],
    assets: [],
    behaviors: [
      {
        objectId: "ball",
        profileId: "profile.ball",
        revision,
        presetKind: "creative",
        rules: [rule],
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

function draft(value: BehaviorRuleView = { ...original, gainLinear: 0.3 }): RuleDraftEntry {
  return { value, baseRevision: 4, pending: false, error: "" };
}

function host(initial: LabViewModel, dispatch: (action: LabAction) => void | Promise<void>) {
  let current = initial;
  const controller: LabController = {
    getSnapshot: () => current,
    subscribe: () => () => {},
    getPose: () => undefined,
    dispatch,
  };
  return {
    controller,
    replace: (value: LabViewModel) => {
      current = value;
    },
  };
}

test("draft keys isolate objects and rules even when identifiers contain separators", () => {
  assert.notEqual(ruleDraftKey("a/b", "c"), ruleDraftKey("a", "b/c"));
  assert.equal(ruleDraftKey("ball", "impact"), ruleDraftKey("ball", "impact"));
});

test("editable patches exclude identity and telemetry and never attach an asset to an oscillator", () => {
  assert.deepEqual(
    editableRulePatch({
      ...original,
      assetId: "stale.asset",
      priority: 80,
      active: true,
      status: "active",
    }),
    {
      trigger: "OnImpact",
      enabled: true,
      generator: "oscillator",
      gainLinear: 0.1,
      pitchSemitones: 0,
      cooldownSeconds: 0.08,
      mapping: "none",
    },
  );
  assert.equal(
    editableRulePatch({ ...original, generator: "sample", assetId: "sample.1" }).assetId,
    "sample.1",
  );
});

test("ack comparisons tolerate numeric rounding and normalize noneditable runtime fields", () => {
  const { mapping: _mapping, ...withoutMapping } = original;
  assert.equal(
    sameEditableRule(original, {
      ...withoutMapping,
      assetId: "irrelevant",
      active: true,
      gainLinear: 0.1 + 5e-9,
    }),
    true,
  );
  for (const patch of [
    { gainLinear: 0.10000002 },
    { pitchSemitones: 0.00000002 },
    { cooldownSeconds: 0.08000002 },
    { enabled: false },
    { trigger: "AlwaysOn" },
    { generator: "sample" as const, assetId: "sample.1" },
    { mapping: "speed" as const },
    { gainLinear: Number.NaN },
  ])
    assert.equal(sameEditableRule(original, { ...original, ...patch }), false);
  assert.equal(
    sameEditableRule(
      { ...original, generator: "sample", assetId: "sample.1" },
      { ...original, generator: "sample", assetId: "sample.2" },
    ),
    false,
  );
});

test("a rejected dispatch keeps the caller's draft intact", async () => {
  const entry = draft();
  const before = structuredClone(entry);
  const { controller } = host(snapshot(), () => Promise.reject(new Error("ASSET_NOT_READY")));
  await assert.rejects(applyRuleDraft(controller, "ball", "rule.impact", entry), /ASSET_NOT_READY/);
  assert.deepEqual(entry, before);
});

test("domain errors after a fulfilled dispatch cannot acknowledge a draft", async () => {
  const entry = draft();
  const runtime = host(snapshot(), () => {
    runtime.replace({ ...snapshot(entry.value, 5), error: "INVALID_PATCH" });
  });
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", entry),
    /INVALID_PATCH/,
  );
});

test("missing rules and stale revisions refuse dispatch before entering an asynchronous gap", async () => {
  let calls = 0;
  const runtime = host(snapshot(original, 5), () => {
    calls += 1;
  });
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", draft()),
    /STALE|REVISION/,
  );
  runtime.replace({ ...snapshot(), behaviors: [] });
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", draft()),
    /RULE|MISSING/,
  );
  assert.equal(calls, 0);
});

test("fulfilled dispatch without an actual matching rule acknowledgement is rejected", async () => {
  const runtime = host(snapshot(), () => {});
  await assert.rejects(applyRuleDraft(runtime.controller, "ball", "rule.impact", draft()), /ACK/);
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", draft(original)),
    /ACK/,
  );
});

test("success requires the original promise and the acknowledged revision and never mutates the cache entry", async () => {
  const entry = draft();
  const before = structuredClone(entry);
  let dispatched: LabAction | undefined;
  let finish: (() => void) | undefined;
  const runtime = host(snapshot(), (action) => {
    dispatched = action;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  let settled = false;
  const pending = applyRuleDraft(runtime.controller, "ball", "rule.impact", entry).then(() => {
    settled = true;
  });
  assert.deepEqual(dispatched, {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.impact",
    patch: {
      trigger: "OnImpact",
      enabled: true,
      generator: "oscillator",
      gainLinear: 0.3,
      pitchSemitones: 0,
      cooldownSeconds: 0.08,
      mapping: "none",
    },
  });
  runtime.replace(snapshot({ ...entry.value, gainLinear: 0.3 + 5e-9 }, 5));
  await Promise.resolve();
  assert.equal(settled, false);
  assert.ok(finish);
  finish();
  await pending;
  assert.equal(settled, true);
  assert.deepEqual(entry, before);
});

test("a rule removed while a transaction is pending cannot silently clear its draft", async () => {
  const runtime = host(snapshot(), () => {
    runtime.replace({ ...snapshot(), behaviors: [] });
  });
  await assert.rejects(applyRuleDraft(runtime.controller, "ball", "rule.impact", draft()), /ACK/);
});

test("invalid raw number edits never apply the previous valid value", async () => {
  let calls = 0;
  const runtime = host(snapshot(), () => {
    calls += 1;
  });
  for (const raw of ["", " ", "not-a-number", "Infinity", "0.9"])
    await assert.rejects(
      applyRuleDraft(runtime.controller, "ball", "rule.impact", {
        ...draft(),
        inputValues: { gainLinear: raw },
      }),
      /DRAFT_INVALID/,
    );
  assert.equal(calls, 0);
});

test("a replacement profile cannot receive a draft authored against another profile", async () => {
  let calls = 0;
  const replaced = snapshot();
  replaced.behaviors[0]!.profileId = "profile.replacement";
  const runtime = host(replaced, () => {
    calls += 1;
  });
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", {
      ...draft(),
      profileId: "profile.ball",
    }),
    /PROFILE|STALE/,
  );
  assert.equal(calls, 0);
});

test("an asynchronous replacement profile cannot masquerade as the original transaction acknowledgement", async () => {
  const entry = draft();
  const runtime = host(snapshot(), () => {
    const replaced = snapshot(entry.value, 5);
    replaced.behaviors[0]!.profileId = "profile.replacement";
    runtime.replace(replaced);
  });
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", entry),
    /ACK|PROFILE/,
  );
});

const speedMapping: SoundParameterMapping = {
  mappingId: "mapping.speed",
  input: "sourceSpeedMetresPerSecond",
  target: "gainLinear",
  inputMin: 0,
  inputMax: 8,
  outputMin: 0.02,
  outputMax: 0.4,
  curve: [
    { x: 0, y: 0 },
    { x: 0.4, y: 0.15 },
    { x: 1, y: 1 },
  ],
  interpolation: "linear",
  clamp: true,
  smoothingSeconds: 0.025,
};

function documentSnapshot(
  rule: BehaviorRuleView = original,
  profileRevision = 4,
  documentRevision = 10,
): LabViewModel {
  const value = snapshot(rule, profileRevision);
  value.behaviors[0]!.bindingId = "binding.ball";
  value.behaviors[0]!.documentRevision = documentRevision;
  return value;
}

function pinnedDraft(value: BehaviorRuleView = { ...original, gainLinear: 0.3 }): RuleDraftEntry {
  return {
    ...draft(value),
    profileId: "profile.ball",
    bindingId: "binding.ball",
    expectedSceneRevision: 1,
    expectedBehaviorRevision: 10,
  };
}

const forkReceipt: NonNullable<LabViewModel["lastBehaviorEdit"]> = {
  objectId: "ball",
  bindingId: "binding.ball",
  beforeDocumentRevision: 10,
  afterDocumentRevision: 11,
  beforeProfileId: "profile.ball",
  afterProfileId: "profile.fork",
  afterProfileRevision: 1,
};

test("canonical mapping patches preserve full curves without leaking base values or binding overrides", () => {
  const rule: BehaviorRuleView = {
    ...original,
    mapping: "impact",
    mappings: [structuredClone(speedMapping)],
    baseValues: { enabled: false, gainLinear: 0.9, pitchSemitones: 7 },
    bindingOverride: { gainLinear: 0.1 },
  };
  const patch = editableRulePatch(rule);
  assert.deepEqual(patch, {
    trigger: "OnImpact",
    enabled: true,
    generator: "oscillator",
    gainLinear: 0.1,
    pitchSemitones: 0,
    cooldownSeconds: 0.08,
    mappings: [
      {
        mappingId: "mapping.speed",
        input: "sourceSpeedMetresPerSecond",
        target: "gainLinear",
        inputMin: 0,
        inputMax: 8,
        outputMin: 0.02,
        outputMax: 0.4,
        curve: [
          { x: 0, y: 0 },
          { x: 0.4, y: 0.15 },
          { x: 1, y: 1 },
        ],
        interpolation: "linear",
        clamp: true,
        smoothingSeconds: 0.025,
      },
    ],
  });
  patch.mappings![0]!.curve[1]!.y = 0.8;
  assert.equal(rule.mappings![0]!.curve[1]!.y, 0.15);
});

test("canonical acknowledgement compares every mapping field and point instead of its legacy summary", () => {
  const rule: BehaviorRuleView = { ...original, mapping: "speed", mappings: [speedMapping] };
  assert.equal(sameEditableRule(rule, { ...rule, mapping: "impact" }), true);
  assert.equal(sameEditableRule(rule, { ...original, mapping: "speed" }), false);
  assert.equal(sameEditableRule({ ...original, mappings: [] }, original), true);
  assert.equal(
    sameEditableRule(rule, {
      ...rule,
      mappings: [
        {
          ...speedMapping,
          inputMax: 8 + 5e-9,
          curve: [
            { x: 0, y: 0 },
            { x: 0.4 + 5e-9, y: 0.15 },
            { x: 1, y: 1 },
          ],
        },
      ],
    }),
    true,
  );
  for (const mapping of [
    { ...speedMapping, mappingId: "mapping.other" },
    { ...speedMapping, input: "normalImpulseNewtonSeconds" as const },
    { ...speedMapping, target: "pitchSemitones" as const },
    { ...speedMapping, inputMin: 0.1 },
    { ...speedMapping, inputMax: 9 },
    { ...speedMapping, outputMin: 0.03 },
    { ...speedMapping, outputMax: 0.5 },
    { ...speedMapping, interpolation: "step" as const },
    { ...speedMapping, smoothingSeconds: 0.03 },
    { ...speedMapping, clamp: false } as unknown as SoundParameterMapping,
    {
      ...speedMapping,
      curve: [
        { x: 0, y: 0 },
        { x: 0.4, y: 0.2 },
        { x: 1, y: 1 },
      ],
    },
    {
      ...speedMapping,
      curve: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.15 },
        { x: 1, y: 1 },
      ],
    },
    {
      ...speedMapping,
      curve: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
  ])
    assert.equal(sameEditableRule(rule, { ...rule, mappings: [mapping] }), false);
  assert.equal(
    sameEditableRule(rule, {
      ...rule,
      mappings: [speedMapping, { ...speedMapping, mappingId: "mapping.second" }],
    }),
    false,
  );
});

test("an invalid mapping draft cannot submit the last accepted mapping", async () => {
  let calls = 0;
  const runtime = host(snapshot(), () => {
    calls += 1;
  });
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", {
      ...draft(),
      mappingError: "curve point is incomplete",
    }),
    /DRAFT_INVALID/,
  );
  assert.equal(calls, 0);
});

test("pinned scene, document and binding revisions reject old UI frames before dispatch", async () => {
  let calls = 0;
  const runtime = host({ ...documentSnapshot(), sceneRevision: 2 }, () => {
    calls += 1;
  });
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", pinnedDraft()),
    /REVISION|STALE/,
  );
  runtime.replace(documentSnapshot(original, 4, 11));
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", pinnedDraft()),
    /REVISION|STALE/,
  );
  const replacedBinding = documentSnapshot();
  replacedBinding.behaviors[0]!.bindingId = "binding.replacement";
  runtime.replace(replacedBinding);
  await assert.rejects(
    applyRuleDraft(runtime.controller, "ball", "rule.impact", pinnedDraft()),
    /BINDING|STALE/,
  );
  assert.equal(calls, 0);
});

test("same-stack dispatch forwards pinned CAS values and acknowledges document advancement", async () => {
  const entry = pinnedDraft();
  let dispatched: LabAction | undefined;
  const runtime = host(documentSnapshot(), (action) => {
    dispatched = action;
    runtime.replace(documentSnapshot(entry.value, 5, 11));
  });
  const pending = applyRuleDraft(runtime.controller, "ball", "rule.impact", entry);
  assert.deepEqual(dispatched, {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.impact",
    patch: {
      trigger: "OnImpact",
      enabled: true,
      generator: "oscillator",
      gainLinear: 0.3,
      pitchSemitones: 0,
      cooldownSeconds: 0.08,
      mapping: "none",
    },
    expectedSceneRevision: 1,
    expectedBehaviorRevision: 10,
  });
  await pending;
});

test("a matching rule without an advanced behavior document is not an acknowledgement", async () => {
  const entry = pinnedDraft();
  const runtime = host(documentSnapshot(), () => {
    runtime.replace(documentSnapshot(entry.value, 5, 10));
  });
  await assert.rejects(applyRuleDraft(runtime.controller, "ball", "rule.impact", entry), /ACK/);
});

test("a shared-profile fork is acknowledged only by the matching trusted edit receipt", async () => {
  const entry = pinnedDraft();
  const runtime = host(documentSnapshot(), () => {
    const after = documentSnapshot(entry.value, 1, 11);
    after.behaviors[0]!.profileId = "profile.fork";
    after.lastBehaviorEdit = forkReceipt;
    runtime.replace(after);
  });
  await applyRuleDraft(runtime.controller, "ball", "rule.impact", entry);
});

test("a stale or unrelated receipt cannot authenticate an external profile replacement", async () => {
  const entry = pinnedDraft();
  const receiptPatches: Partial<NonNullable<LabViewModel["lastBehaviorEdit"]>>[] = [
    { objectId: "other" },
    { bindingId: "binding.other" },
    { beforeDocumentRevision: 9 },
    { afterDocumentRevision: 12 },
    { beforeProfileId: "profile.other" },
    { afterProfileId: "profile.other" },
    { afterProfileRevision: 2 },
  ];
  for (const patch of receiptPatches) {
    const runtime = host(documentSnapshot(), () => {
      const after = documentSnapshot(entry.value, 1, 11);
      after.behaviors[0]!.profileId = "profile.fork";
      after.lastBehaviorEdit = { ...forkReceipt, ...patch };
      runtime.replace(after);
    });
    await assert.rejects(applyRuleDraft(runtime.controller, "ball", "rule.impact", entry), /ACK/);
  }
});

test("a curve-only edit submits only canonical mappings and preserves binding override authoring ownership", async () => {
  const unchanged = {
    ...original,
    mappings: [],
    baseValues: { enabled: true, gainLinear: 0.8, pitchSemitones: 4 },
    bindingOverride: { gainLinear: 0.1, pitchSemitones: 0 },
  };
  const entry = {
    ...pinnedDraft({ ...unchanged, mappings: [speedMapping] }),
    changedFields: ["mappings" as const],
  };
  let dispatched: LabAction | undefined;
  const runtime = host(documentSnapshot(unchanged), (action) => {
    dispatched = action;
    runtime.replace(documentSnapshot(entry.value, 5, 11));
  });
  await applyRuleDraft(runtime.controller, "ball", "rule.impact", entry);
  assert.deepEqual(dispatched, {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.impact",
    patch: { mappings: [speedMapping] },
    expectedSceneRevision: 1,
    expectedBehaviorRevision: 10,
  });
});
