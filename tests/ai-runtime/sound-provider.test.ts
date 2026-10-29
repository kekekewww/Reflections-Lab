import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_META_CONFIG, MetaProvider } from "../../server/meta-provider.js";
import type { MetaProviderConfig } from "../../server/meta-provider.js";
import type { SoundHostState } from "../../src/ai/sound-host.js";
import { Ajv2020 } from "ajv/dist/2020.js";
import { createMetaSoundFunctionTools, decodeSoundOperations } from "../../server/sound-tools.js";
import { validateSoundPlannerInput } from "../../src/ai/sound-plan.js";
import proposalSchema from "../../schemas/sound-behavior/sound-behavior-ai.schema.json" with { type: "json" };
import documentSchema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };

// All response descriptors and transports are injected. No Meta request or
// decoding/playback is performed; READY assets below are domain-policy fixtures.
const hash = "a".repeat(64);
const fixtureKey = "fixture-not-a-real-sound-api-key";
function config(): MetaProviderConfig {
  return {
    ...DEFAULT_META_CONFIG,
    apiKey: fixtureKey,
    networkEnabled: true,
    modelId: "model.sound-fixture",
    verificationStatus: "verified",
    verifiedAt: "2026-10-27T00:00:00.000Z",
    verificationArtifactId: "artifact.mock-sound-access",
    maxEstimatedCostUsd: 1,
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 2,
    pricingSource: "MOCK_PRICING_ONLY",
    maxCompletionTokens: 1000,
  };
}
function state(): SoundHostState {
  return {
    sceneId: "scene.sound-provider",
    sceneRevision: 4,
    document: {
      schemaVersion: "1.0.0",
      documentId: "behavior.sound-provider",
      revision: 2,
      assets: [],
      profiles: [],
      bindings: [],
    },
    context: {
      sceneRevision: 4,
      objects: [{ objectId: "object.ball", generation: 3 }],
      materialIds: ["material.synthetic"],
      zoneIds: [],
      assetRegistry: [
        {
          assetId: "asset.descriptor",
          revision: 1,
          sha256: hash,
          availability: "READY",
          rightsStatus: "APPROVED",
          durationSeconds: 1,
        },
      ],
    },
  };
}
function profile() {
  return {
    profileId: "profile.sound-fixture",
    revision: 1,
    name: "Synthetic creative impact",
    presetKind: "creative",
    materialPairOverrides: [],
    rules: [
      {
        ruleId: "rule.impact",
        enabled: true,
        trigger: { kind: "discrete", type: "OnImpact" },
        conditions: [],
        generator: { kind: "oscillator", waveform: "sine", frequencyHz: 440 },
        emitter: { attachment: "contact", aggregation: "representative" },
        gainLinear: 0.4,
        pitchSemitones: 0,
        fadeInSeconds: 0.01,
        fadeOutSeconds: 0.03,
        cooldownSeconds: 0.08,
        priority: 50,
        voiceLimit: 2,
        layerGroup: "layer.creative",
        mappings: [],
        lifecycle: null,
        oneShotDurationSeconds: 0.2,
      },
    ],
  };
}
function args() {
  return {
    operations: [
      { type: "CreateProfile", profile: profile() },
      {
        type: "AssignBinding",
        binding: {
          bindingId: "binding.ball",
          objectId: "object.ball",
          objectGeneration: 3,
          profileId: "profile.sound-fixture",
          profileRevision: 1,
          enabled: true,
          overrides: [],
        },
      },
    ],
  };
}
function payload(argumentsValue: unknown = args(), tool = "ProposeSoundBehavior") {
  return {
    id: "response.mock-sound",
    model: "model.sound-fixture",
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call.sound-fixture",
              type: "function",
              function: { name: tool, arguments: JSON.stringify(argumentsValue) },
            },
          ],
        },
      },
    ],
  };
}
function transport(
  value: unknown,
  inspect?: (input: unknown, init?: RequestInit) => void,
): typeof fetch {
  return async (input, init) => {
    inspect?.(input, init);
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}
async function rejectCode(action: Promise<unknown>, expected: string | string[]) {
  await assert.rejects(action, (error: unknown) => {
    const code = (error as { code?: unknown }).code;
    assert.ok(
      (Array.isArray(expected) ? expected : [expected]).includes(String(code)),
      String(code),
    );
    assert.equal(String(error).includes(fixtureKey), false);
    return true;
  });
}
test("Meta Sound default zero budget rejects before any transport dispatch", async () => {
  let fetches = 0;
  const provider = new MetaProvider(DEFAULT_META_CONFIG, {
    fetch: transport(payload(), () => {
      fetches++;
    }),
  });
  await rejectCode(provider.planSound("撞擊時發出電子音", state()), "PROVIDER_UNVERIFIED");
  assert.equal(fetches, 0);
});
test("Meta Sound accepts only operations and fills immutable envelope from the host snapshot", async () => {
  const current = state();
  const before = structuredClone(current);
  let fetched = 0;
  const provider = new MetaProvider(config(), {
    fetch: transport(payload(), (_input, init) => {
      fetched++;
      const sent = JSON.parse(String(init?.body));
      assert.equal(sent.tools.length, 1);
      assert.equal(sent.tools[0].function.name, "ProposeSoundBehavior");
      assert.equal(sent.tools[0].function.strict, true);
      assert.equal(sent.tool_choice, "auto");
      assert.equal(sent.parallel_tool_calls, false);
      assert.ok(new TextEncoder().encode(String(init?.body)).length < 32000);
      assert.deepEqual(Object.keys(sent.tools[0].function.parameters.properties), ["operations"]);
      assert.equal(String(init?.body).includes(fixtureKey), false);
    }),
  });
  const plan = await provider.planSound("撞擊時發出電子音", current, {
    selectedObjectId: "object.ball",
  });
  assert.equal(fetched, 1);
  assert.equal(plan.proposal.sceneId, current.sceneId);
  assert.equal(plan.proposal.expectedSceneRevision, 4);
  assert.equal(plan.proposal.expectedBehaviorRevision, 2);
  assert.equal(plan.provenance.label, "META_LIVE");
  assert.equal(plan.provenance.requestId, "response.mock-sound");
  assert.equal("lifecycle" in plan.proposal.operations[0]!.profile.rules[0]!, false);
  assert.deepEqual(current, before);
});

test("Meta Sound rejects a numbered choices object and non-assistant messages", async () => {
  const numbered = payload();
  const wrongRole = payload();
  wrongRole.choices[0]!.message.role = "user";
  for (const value of [{ ...numbered, choices: { 0: numbered.choices[0] } }, wrongRole]) {
    const provider = new MetaProvider(config(), { fetch: transport(value) });
    await rejectCode(provider.planSound("撞擊時發出電子音", state()), "PROVIDER_REQUEST_FAILED");
  }
});

test("Sound provider schema keeps every object closed, requires nullable fields, and stays within ten container levels", () => {
  type S = Record<string, unknown>;
  const tools = createMetaSoundFunctionTools() as { function: { parameters: S } }[];
  const parameters = tools[0]!.function.parameters;
  const defs = parameters.$defs as Record<string, S>;
  const visit = (node: S, depth: number): number => {
    assert.equal("oneOf" in node || "allOf" in node, false);
    if (node.$ref) {
      assert.match(String(node.$ref), /^#\/\$defs\/[A-Za-z0-9]+$/);
      return visit(defs[String(node.$ref).slice(8)]!, depth);
    }
    if (Array.isArray(node.anyOf))
      return Math.max(...node.anyOf.map((child) => visit(child as S, depth)));
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false);
      const props = node.properties as Record<string, S>;
      assert.deepEqual([...(node.required as string[])].sort(), Object.keys(props).sort());
      return Math.max(depth + 1, ...Object.values(props).map((child) => visit(child, depth + 1)));
    }
    if (node.type === "array") return visit(node.items as S, depth + 1);
    return depth;
  };
  assert.equal(visit(parameters, 0), 10);
  const operations = ((parameters.properties as S).operations as S).items as S;
  assert.deepEqual(
    (operations.anyOf as S[]).map((branch) => ((branch.properties as S).type as S).const),
    ["CreateProfile", "ReplaceProfile", "DeleteProfile", "AssignBinding", "RemoveBinding"],
  );
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(parameters);
  assert.equal(validate(args()), true, ajv.errorsText(validate.errors));
  const missingNullable = args();
  delete (missingNullable.operations[0]!.profile!.rules[0] as unknown as Record<string, unknown>)
    .lifecycle;
  assert.equal(validate(missingNullable), false);
  const changedTools = createMetaSoundFunctionTools() as { function: { parameters: S } }[];
  changedTools[0]!.function.parameters.additionalProperties = true;
  assert.equal(
    (createMetaSoundFunctionTools() as typeof tools)[0]!.function.parameters.additionalProperties,
    false,
  );
});

test("provider grammar omits uniqueItems while original Sound validation rejects duplicate lifecycle stops", async () => {
  type Schema = Record<string, unknown>;
  const tools = createMetaSoundFunctionTools() as { function: { parameters: Schema } }[];
  const parameters = tools[0]!.function.parameters;
  const inspect = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    const node = value as Schema;
    assert.equal("uniqueItems" in node, false, "remote grammar cannot advertise uniqueItems");
    Object.values(node).forEach(inspect);
  };
  inspect(parameters);
  assert.equal(documentSchema.$defs.RuleLifecycle.properties.stopOn.uniqueItems, true);

  const duplicate = args();
  const rule = duplicate.operations[0]!.profile!.rules[0]! as unknown as Schema;
  rule.trigger = { kind: "discrete", type: "OnThrow" };
  rule.emitter = { attachment: "object", offsetMetres: [0, 0, 0] };
  rule.lifecycle = {
    mode: "latched",
    stopOn: ["OnImpact", "OnImpact"],
    retriggerPolicy: "restart",
    maxDurationSeconds: 10,
  };
  rule.oneShotDurationSeconds = null;
  const grammar = new Ajv2020({ strict: true, allErrors: true }).compile(parameters);
  assert.equal(grammar(duplicate), true, "provider shape alone does not establish uniqueness");
  assert.throws(
    () => decodeSoundOperations(duplicate),
    (error: unknown) => {
      const rejected = error as { code?: string; fieldPaths?: string[] };
      assert.equal(rejected.code, "SCHEMA_INVALID");
      assert.ok(rejected.fieldPaths?.some((path) => path.endsWith("/lifecycle/stopOn")));
      return true;
    },
  );
  const current = state();
  const before = structuredClone(current);
  await rejectCode(
    new MetaProvider(config(), { fetch: transport(payload(duplicate)) }).planSound(
      "設定投擲聲音",
      current,
    ),
    "SCHEMA_INVALID",
  );
  assert.deepEqual(current, before);

  (rule.lifecycle as Schema).stopOn = ["OnImpact", "OnGrab"];
  const accepted = await new MetaProvider(config(), {
    fetch: transport(payload(duplicate)),
  }).planSound("設定投擲聲音", current);
  const operation = accepted.proposal.operations[0]!;
  assert.equal(operation.type, "CreateProfile");
  if (operation.type !== "CreateProfile") throw Error("fixture shape");
  assert.deepEqual(operation.profile.rules[0]!.lifecycle?.stopOn, ["OnImpact", "OnGrab"]);
  assert.deepEqual(current, before);
});

test("wire-valid duplicate operations, binding IDs, and rule IDs are rejected by the trusted Sound host", async () => {
  const tools = createMetaSoundFunctionTools() as { function: { parameters: object } }[];
  const grammar = new Ajv2020({ strict: true, allErrors: true }).compile(
    tools[0]!.function.parameters,
  );
  for (const duplicate of ["profile-operation", "binding-operation", "rule-id"] as const) {
    const value = args();
    if (duplicate === "profile-operation")
      value.operations.splice(1, 0, structuredClone(value.operations[0]!));
    else if (duplicate === "binding-operation")
      value.operations.push(structuredClone(value.operations[1]!));
    else
      value.operations[0]!.profile!.rules.push(
        structuredClone(value.operations[0]!.profile!.rules[0]!),
      );
    assert.equal(grammar(value), true, "provider wire shape is not a uniqueness authority");
    assert.equal(decodeSoundOperations(value).length, value.operations.length);
    const current = state();
    const before = structuredClone(current);
    await rejectCode(
      new MetaProvider(config(), { fetch: transport(payload(value)) }).planSound(
        "設定合成聲音",
        current,
      ),
      "DUPLICATE_ID",
    );
    assert.deepEqual(current, before);
  }
});

test("optional null decoding preserves required null rejection, explicit false, and real zero", () => {
  const value = args();
  value.operations[0]!.profile!.rules[0]!.oneShotDurationSeconds = null as unknown as number;
  value.operations[1]!.binding!.overrides = [
    {
      ruleId: "rule.impact",
      enabled: false,
      gainLinear: 0,
      pitchSemitones: 0,
    },
  ] as never[];
  const decoded = decodeSoundOperations(value);
  assert.equal(decoded[0]!.type, "CreateProfile");
  if (decoded[0]!.type !== "CreateProfile" || decoded[1]!.type !== "AssignBinding")
    throw Error("fixture shape");
  assert.equal("lifecycle" in decoded[0]!.profile.rules[0]!, false);
  assert.equal("oneShotDurationSeconds" in decoded[0]!.profile.rules[0]!, false);
  assert.deepEqual(decoded[1]!.binding.overrides[0], {
    ruleId: "rule.impact",
    enabled: false,
    gainLinear: 0,
    pitchSemitones: 0,
  });
  const withNullOverride = structuredClone(value);
  (withNullOverride.operations[1]!.binding!.overrides as unknown[]) = [
    {
      ruleId: "rule.impact",
      enabled: null,
      gainLinear: null,
      pitchSemitones: null,
    },
  ];
  const nullDecoded = decodeSoundOperations(withNullOverride);
  if (nullDecoded[1]!.type !== "AssignBinding") throw Error("fixture shape");
  assert.deepEqual(nullDecoded[1]!.binding.overrides[0], { ruleId: "rule.impact" });
  for (const key of ["ruleId", "gainLinear"]) {
    const invalid = args();
    (invalid.operations[0]!.profile!.rules[0] as unknown as Record<string, unknown>)[key] = null;
    assert.throws(() => decodeSoundOperations(invalid), { code: "SCHEMA_INVALID" });
  }
  const originalAjv = new Ajv2020({ strict: true });
  originalAjv.addSchema(documentSchema);
  const original = originalAjv.compile(proposalSchema);
  assert.equal(
    original({
      schemaVersion: "1.0.0",
      proposalId: "proposal.decoder",
      sceneId: "scene.decoder",
      expectedSceneRevision: 0,
      expectedBehaviorRevision: 0,
      operations: decoded,
    }),
    true,
    originalAjv.errorsText(original.errors),
  );
});

test("one Meta Sound call can exercise all five original operations without committing", async () => {
  const current = state();
  const decoded = decodeSoundOperations(args());
  if (decoded[0]!.type !== "CreateProfile" || decoded[1]!.type !== "AssignBinding")
    throw Error("fixture shape");
  current.document.profiles = [decoded[0]!.profile];
  current.document.bindings = [decoded[1]!.binding];
  const replacement = profile();
  replacement.revision = 2;
  const temporary = profile();
  temporary.profileId = "profile.temporary";
  const operations = [
    { type: "RemoveBinding", bindingId: "binding.ball" },
    {
      type: "ReplaceProfile",
      profileId: replacement.profileId,
      expectedProfileRevision: 1,
      profile: replacement,
    },
    { type: "CreateProfile", profile: temporary },
    { type: "AssignBinding", binding: { ...decoded[1]!.binding, profileRevision: 2 } },
    { type: "DeleteProfile", profileId: temporary.profileId, expectedProfileRevision: 1 },
  ];
  const before = structuredClone(current);
  const provider = new MetaProvider(config(), { fetch: transport(payload({ operations })) });
  const plan = await provider.planSound("調整聲音profile與binding", current);
  assert.deepEqual(
    plan.proposal.operations.map((operation) => operation.type),
    operations.map((operation) => operation.type),
  );
  assert.deepEqual(current, before);
});

test("strict Sound arguments reject unknown operations, extra fields, and model-supplied host metadata", async () => {
  for (const value of [
    { ...args(), sceneId: "scene.forged" },
    { ...args(), expectedSceneRevision: 999 },
    { ...args(), expectedBehaviorRevision: 999 },
    { ...args(), proposalId: "proposal.forged" },
    { ...args(), approvedBy: "human" },
    { operations: [{ type: "RunJavaScript", code: "execute()" }] },
    {
      operations: [
        { type: "DeleteProfile", profileId: "profile.x", expectedProfileRevision: 1, extra: true },
      ],
    },
  ]) {
    const provider = new MetaProvider(config(), { fetch: transport(payload(value)) });
    await rejectCode(provider.planSound("調整聲音", state()), "SCHEMA_INVALID");
  }
});

test("Sound preflight refuses forged or missing asset pins and stale object generations", async () => {
  const sampleArgs = (): ReturnType<typeof args> => {
    const value = args();
    (value.operations[0]!.profile!.rules[0] as unknown as Record<string, unknown>).generator = {
      kind: "sample",
      asset: { assetId: "asset.descriptor", revision: 1, sha256: hash },
      loop: false,
      startOffsetSeconds: 0,
    };
    return value;
  };
  const accepted = new MetaProvider(config(), { fetch: transport(payload(sampleArgs())) });
  const valid = await accepted.planSound("使用已授權示範音檔", state());
  assert.equal(valid.proposal.operations[0]?.type, "CreateProfile");
  for (const [field, invalid] of [
    ["assetId", "asset.unknown"],
    ["revision", 2],
    ["sha256", "b".repeat(64)],
  ] as const) {
    const value = sampleArgs();
    const generator = value.operations[0]!.profile!.rules[0]!.generator as unknown as {
      asset: Record<string, unknown>;
    };
    generator.asset[field] = invalid;
    const provider = new MetaProvider(config(), { fetch: transport(payload(value)) });
    await rejectCode(provider.planSound("使用音檔", state()), "UNKNOWN_ASSET");
  }
  const generation = args();
  generation.operations[1]!.binding!.objectGeneration = 2;
  await rejectCode(
    new MetaProvider(config(), { fetch: transport(payload(generation)) }).planSound(
      "設定聲音",
      state(),
    ),
    "STALE_OBJECT_GENERATION",
  );
});

test("Sound preflight rejects stale profile revisions, unknown objects, and unauthorized assets", async () => {
  const decoded = decodeSoundOperations(args());
  if (decoded[0]!.type !== "CreateProfile") throw Error("fixture shape");
  const current = state();
  current.document.profiles = [decoded[0]!.profile];
  const replacement = profile();
  replacement.revision = 3;
  await rejectCode(
    new MetaProvider(config(), {
      fetch: transport(
        payload({
          operations: [
            {
              type: "ReplaceProfile",
              profileId: replacement.profileId,
              expectedProfileRevision: 2,
              profile: replacement,
            },
          ],
        }),
      ),
    }).planSound("調整聲音", current),
    "STALE_PROFILE_REVISION",
  );
  const unknown = args();
  unknown.operations[1]!.binding!.objectId = "object.unknown";
  await rejectCode(
    new MetaProvider(config(), { fetch: transport(payload(unknown)) }).planSound(
      "設定聲音",
      state(),
    ),
    "UNKNOWN_OBJECT",
  );
  for (const [field, invalid] of [
    ["availability", "MISSING"],
    ["rightsStatus", "UNVERIFIED"],
  ] as const) {
    const assetState = state();
    (assetState.context.assetRegistry[0] as unknown as Record<string, unknown>)[field] = invalid;
    const value = args();
    (value.operations[0]!.profile!.rules[0] as unknown as Record<string, unknown>).generator = {
      kind: "sample",
      asset: { assetId: "asset.descriptor", revision: 1, sha256: hash },
      loop: false,
      startOffsetSeconds: 0,
    };
    await rejectCode(
      new MetaProvider(config(), { fetch: transport(payload(value)) }).planSound(
        "使用音檔",
        assetState,
      ),
      "ASSET_NOT_READY",
    );
  }
});

test("Sound input validates exact keys, selected IDs, revisions and product context before transport", async () => {
  for (const value of [
    { state: state(), options: { apiKey: "forged" } },
    { state: state(), options: { maxEstimatedCostUsd: 1 } },
    { state: state(), options: { selectedObjectId: "object.unknown" } },
    { state: state(), options: { assetLabels: { "asset.unknown": "forged" } } },
    { state: { ...state(), sceneRevision: 5 } },
    { state: { ...state(), context: { ...state().context, validationMode: "offlineFixture" } } },
  ])
    assert.throws(() => validateSoundPlannerInput(value));
  let fetches = 0;
  const provider = new MetaProvider(config(), {
    fetch: transport(payload(), () => {
      fetches++;
    }),
  });
  await rejectCode(
    provider.planSound("設定聲音", state(), { selectedObjectId: "object.unknown" }),
    "UNKNOWN_OBJECT",
  );
  await rejectCode(provider.planSound("設定聲音", state(), null as never), "SCHEMA_INVALID");
  assert.equal(fetches, 0);
});

test("Sound refuses unknown tools, text-only replies, refusals, truncation, incomplete JSON, and simultaneous calls", async () => {
  const text = payload();
  (text.choices[0]!.message as unknown as Record<string, unknown>).tool_calls = undefined;
  text.choices[0]!.message.content = "已設定為完美聲音" as never;
  const refusal = payload();
  (refusal.choices[0]!.message as unknown as Record<string, unknown>).refusal = "拒絕";
  const truncated = payload();
  truncated.choices[0]!.finish_reason = "length";
  const incomplete = payload();
  incomplete.choices[0]!.message.tool_calls[0]!.function.arguments = '{"operations":';
  const multiple = payload();
  multiple.choices[0]!.message.tool_calls.push(
    structuredClone(multiple.choices[0]!.message.tool_calls[0]!),
  );
  for (const value of [
    text,
    refusal,
    truncated,
    incomplete,
    multiple,
    payload(args(), "AddObject"),
  ])
    await rejectCode(
      new MetaProvider(config(), { fetch: transport(value) }).planSound("設定聲音", state()),
      ["SCHEMA_INVALID", "PROVIDER_REQUEST_FAILED"],
    );
});

test("Sound calls share the original turn/cost gates and transient retry policy", async () => {
  let fetches = 0;
  const waits: number[] = [];
  const retried = new MetaProvider(config(), {
    fetch: async () =>
      ++fetches < 3
        ? new Response(JSON.stringify({ error: { code: null } }), { status: 429 })
        : new Response(JSON.stringify(payload()), { status: 200 }),
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
  await retried.planSound("設定聲音", state());
  assert.equal(fetches, 3);
  assert.deepEqual(waits, [500, 1000]);
  assert.ok(retried.usage().reservedCostUsd > 0);
  let boundedFetches = 0;
  const bounded = new MetaProvider(config(), {
    fetch: transport(payload(), () => {
      boundedFetches++;
    }),
  });
  for (let turn = 0; turn < 12; turn++) await bounded.planSound("設定聲音", state());
  await rejectCode(bounded.planSound("設定聲音", state()), "BUDGET_EXCEEDED");
  assert.equal(boundedFetches, 12);
  let noBudgetFetches = 0;
  const insufficient = new MetaProvider(
    { ...config(), maxEstimatedCostUsd: 0.000001 },
    {
      fetch: transport(payload(), () => {
        noBudgetFetches++;
      }),
    },
  );
  await rejectCode(insufficient.planSound("設定聲音", state()), "BUDGET_EXCEEDED");
  assert.equal(noBudgetFetches, 0);
});

test("Sound transport preserves HTTP classifications when an error response is JSON null", async () => {
  for (const [status, expected] of [
    [401, "AUTHENTICATION_ERROR"],
    [429, "RATE_LIMITED"],
  ] as const) {
    const provider = new MetaProvider(
      { ...config(), maxRetries: 0 },
      {
        fetch: async () => new Response("null", { status }),
      },
    );
    await rejectCode(provider.planSound("設定聲音", state()), expected);
  }
});

test("nested strict unions retain conditions, sample/oscillator, all emitters, mappings, and bounded latch semantics", async () => {
  const cases: {
    trigger: unknown;
    emitter: unknown;
    generator: unknown;
    lifecycle?: unknown;
    duration?: number | null;
  }[] = [
    {
      trigger: { kind: "discrete", type: "OnImpact" },
      emitter: { attachment: "contact", aggregation: "impulseWeighted" },
      generator: {
        kind: "sample",
        asset: { assetId: "asset.descriptor", revision: 1, sha256: hash },
        loop: false,
        startOffsetSeconds: 0,
      },
    },
    {
      trigger: { kind: "continuous", type: "AlwaysOn" },
      emitter: { attachment: "object", offsetMetres: [0, 0, 0] },
      generator: { kind: "oscillator", waveform: "triangle", frequencyHz: 220 },
      duration: null,
    },
    {
      trigger: { kind: "continuous", type: "WhileMoving" },
      emitter: { attachment: "fixed", positionMetres: [1, 1, 1] },
      generator: {
        kind: "sample",
        asset: { assetId: "asset.descriptor", revision: 1, sha256: hash },
        loop: true,
        startOffsetSeconds: 0,
      },
      duration: null,
    },
    {
      trigger: { kind: "discrete", type: "OnEnterZone" },
      emitter: { attachment: "zone", zoneId: "zone.test" },
      generator: { kind: "oscillator", waveform: "square", frequencyHz: 440 },
    },
    {
      trigger: { kind: "discrete", type: "OnThrow" },
      emitter: { attachment: "object", offsetMetres: [0, 0, 0] },
      generator: { kind: "oscillator", waveform: "sawtooth", frequencyHz: 440 },
      duration: null,
      lifecycle: {
        mode: "latched",
        stopOn: ["OnImpact"],
        retriggerPolicy: "restart",
        maxDurationSeconds: 10,
      },
    },
  ];
  for (const variant of cases) {
    const current = state();
    current.context.zoneIds = ["zone.test"];
    current.context.zonePositions = { "zone.test": [0, 1, 0] };
    const value = args();
    const rule = value.operations[0]!.profile!.rules[0]! as unknown as Record<string, unknown>;
    Object.assign(rule, {
      trigger: variant.trigger,
      emitter: variant.emitter,
      generator: variant.generator,
    });
    rule.lifecycle = variant.lifecycle ?? null;
    rule.oneShotDurationSeconds = variant.duration === undefined ? 0.2 : variant.duration;
    rule.conditions = [
      { kind: "metric", input: "sourceSpeedMetresPerSecond", operator: "gte", value: 0 },
      { kind: "state", state: "moving", equals: false },
      ...((variant.emitter as { attachment: string }).attachment === "contact"
        ? [
            {
              kind: "materialPair",
              materialA: "material.synthetic",
              materialB: "material.synthetic",
            },
          ]
        : []),
    ];
    rule.mappings = [
      {
        mappingId: "mapping.speed",
        input: "sourceSpeedMetresPerSecond",
        target: "gainLinear",
        inputMin: 0,
        inputMax: 10,
        outputMin: 0,
        outputMax: 1,
        curve: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        interpolation: "linear",
        clamp: true,
        smoothingSeconds: 0.02,
      },
    ];
    const provider = new MetaProvider(config(), { fetch: transport(payload(value)) });
    const plan = await provider.planSound("設定聲音規則", current);
    if (plan.proposal.operations[0]!.type !== "CreateProfile") throw Error("fixture shape");
    assert.deepEqual(plan.proposal.operations[0]!.profile.rules[0]!.trigger, variant.trigger);
    assert.deepEqual(plan.proposal.operations[0]!.profile.rules[0]!.emitter, variant.emitter);
    assert.deepEqual(plan.proposal.operations[0]!.profile.rules[0]!.mappings, rule.mappings);
  }
});
