import { Ajv2020 } from "ajv/dist/2020.js";
import behaviorSchema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import type { SoundBehaviorDocument, SoundGenerator } from "../../schemas/sound-behavior/types.js";
import { createScene } from "../scene/validate-scene.js";
import { validateBehaviorAuthoring } from "../audio-behavior/profile-registry.js";
import { validateEditorMetadata } from "./editor-metadata.js";
import {
  ProjectError,
  type ProjectAsset,
  type ProjectDocument,
  type RecordingReference,
} from "./types.js";

export const MAX_PROJECT_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();
const behaviorValidator = new Ajv2020({
  strict: true,
  allErrors: true,
  ownProperties: true,
}).compile<SoundBehaviorDocument>(behaviorSchema);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const hashPattern = /^[a-f0-9]{64}$/;
function fail(code: string, message: string): never {
  throw new ProjectError(code, message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail("PROJECT_INVALID", `${label} must be an object`);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail("UNKNOWN_FIELD", `${label}.${key}`);
}
function text(value: unknown, max: number, label: string): asserts value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > max)
    fail("PROJECT_INVALID", `${label} must be bounded nonempty text`);
}
function integer(value: unknown, min: number, max: number, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    fail("PROJECT_INVALID", `${label} is outside its integer range`);
}
function id(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !idPattern.test(value))
    fail("PROJECT_INVALID", `${label} must be a stable ID`);
}
function finite(value: unknown, min: number, max: number, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    fail("PROJECT_INVALID", `${label} is outside its finite range`);
}
function timestamp(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail("PROJECT_INVALID", `${label} must be an ISO UTC timestamp`);
  const canonical = new Date(value as string).toISOString();
  if (canonical !== value && canonical.replace(".000Z", "Z") !== value)
    fail("PROJECT_INVALID", `${label} is not a real date`);
}

/** Check before JSON.stringify so nonfinite values and executable objects are never silently repaired. */
export function assertProjectJson(input: unknown): void {
  const ancestors = new Set<object>();
  let nodes = 0;
  function visit(value: unknown, depth: number): void {
    if (++nodes > 150000 || depth > 48) fail("SIZE_LIMIT", "Project exceeds JSON node/depth limit");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "string") {
      if (value.length > MAX_PROJECT_BYTES) fail("SIZE_LIMIT", "Project string exceeds limit");
      return;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) fail("NON_JSON_VALUE", "Numbers must be finite");
      return;
    }
    if (typeof value !== "object") fail("NON_JSON_VALUE", "Only plain JSON values are accepted");
    if (ancestors.has(value)) fail("CYCLE", "Cyclic project data is not serializable");
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
      fail("NON_JSON_VALUE", "Engine objects are not project data");
    if (Object.getOwnPropertySymbols(value).length)
      fail("NON_JSON_VALUE", "Symbol properties are not project data");
    if (
      Array.isArray(value) &&
      (value.length > 150000 || Object.keys(value).length !== value.length)
    )
      fail("NON_JSON_VALUE", "Sparse arrays are not project data");
    ancestors.add(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      if (Array.isArray(value) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (descriptor.get || descriptor.set || !descriptor.enumerable)
        fail("NON_JSON_VALUE", "Accessors and hidden properties are not project data");
      if (Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
        fail("NON_JSON_VALUE", "Named array properties are not project data");
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
  }
  visit(input, 0);
  if (encoder.encode(JSON.stringify(input)).byteLength > MAX_PROJECT_BYTES)
    fail("SIZE_LIMIT", "Project exceeds byte budget");
}

function validateAsset(input: unknown): ProjectAsset {
  const value = object(input, "asset");
  fields(
    value,
    [
      "assetId",
      "revision",
      "sha256",
      "hashKind",
      "name",
      "mimeType",
      "byteLength",
      "storage",
      "rights",
      "generator",
    ],
    "asset",
  );
  id(value.assetId, "asset.assetId");
  integer(value.revision, 1, 2147483647, "asset.revision");
  if (typeof value.sha256 !== "string" || !hashPattern.test(value.sha256))
    fail("ASSET_HASH", "Asset hash must be SHA256");
  if (
    value.hashKind !== undefined &&
    !["encodedBytesSha256", "canonicalDescriptorSha256", "float32MonoPcmBytesSha256"].includes(
      value.hashKind as string,
    )
  )
    fail("ASSET_HASH", "Unknown asset hash kind");
  text(value.name, 256, "asset.name");
  text(value.mimeType, 128, "asset.mimeType");
  integer(value.byteLength, 0, 64 * 1024 * 1024, "asset.byteLength");
  const rights = object(value.rights, "asset.rights");
  fields(rights, ["license", "source", "attribution"], "asset.rights");
  text(rights.license, 512, "asset.rights.license");
  text(rights.source, 2048, "asset.rights.source");
  if (rights.attribution !== undefined) text(rights.attribution, 2048, "asset.rights.attribution");
  if (value.storage !== "externalFile" && value.storage !== "generatedDescriptor")
    fail("ASSET_STORAGE", "Unknown asset storage kind");
  if (value.storage === "externalFile" && value.generator !== undefined)
    fail("ASSET_STORAGE", "External files cannot masquerade as generated audio");
  if (
    value.storage === "externalFile" &&
    value.hashKind !== undefined &&
    value.hashKind !== "encodedBytesSha256"
  )
    fail("ASSET_HASH", "External file SHA must cover encoded bytes");
  if (value.storage === "generatedDescriptor") {
    const generator = object(value.generator, "asset.generator");
    fields(
      generator,
      ["algorithm", "durationSeconds", "sampleRateHz", "frequencyHz", "seed"],
      "asset.generator",
    );
    if (
      ![
        "tone-v1",
        "noise-v1",
        "impulse-v1",
        "builtin-tone-v1",
        "builtin-impact-v1",
        "builtin-whoosh-v1",
      ].includes(generator.algorithm as string)
    )
      fail("ASSET_GENERATOR", "Unknown generator algorithm");
    finite(generator.durationSeconds, 0.001, 30, "asset.generator.durationSeconds");
    if (generator.sampleRateHz !== 44100 && generator.sampleRateHz !== 48000)
      fail("ASSET_GENERATOR", "Unsupported sample rate");
    if (generator.frequencyHz !== undefined)
      finite(generator.frequencyHz, 20, 20000, "asset.generator.frequencyHz");
    if (generator.algorithm === "tone-v1" && generator.frequencyHz === undefined)
      fail("ASSET_GENERATOR", "Tone frequency is required");
    if (generator.seed !== undefined)
      integer(generator.seed, 0, 4294967295, "asset.generator.seed");
    if (generator.algorithm === "noise-v1" && generator.seed === undefined)
      fail("ASSET_GENERATOR", "Noise seed is required for regeneration");
    const builtinDuration = {
      "builtin-tone-v1": 1,
      "builtin-impact-v1": 0.25,
      "builtin-whoosh-v1": 0.5,
    }[generator.algorithm as string];
    if (
      builtinDuration !== undefined &&
      (value.hashKind !== "float32MonoPcmBytesSha256" ||
        generator.durationSeconds !== builtinDuration ||
        generator.frequencyHz !== undefined ||
        generator.seed !== undefined ||
        value.byteLength !==
          Math.round((generator.sampleRateHz as number) * builtinDuration) *
            Float32Array.BYTES_PER_ELEMENT)
    )
      fail(
        "ASSET_GENERATOR",
        "Builtin descriptors require exact fixed generator settings and PCM hash provenance",
      );
    if (
      builtinDuration === undefined &&
      value.hashKind !== undefined &&
      value.hashKind !== "canonicalDescriptorSha256"
    )
      fail("ASSET_HASH", "Legacy generator SHA covers a descriptor, not decoded PCM");
  }
  return value as unknown as ProjectAsset;
}

function validateRecording(input: unknown): RecordingReference {
  const value = object(input, "recording");
  fields(
    value,
    ["runId", "sha256", "status", "frameCount", "durationSeconds", "storage"],
    "recording",
  );
  id(value.runId, "recording.runId");
  if (
    typeof value.sha256 !== "string" ||
    !hashPattern.test(value.sha256) ||
    !["captured", "interrupted"].includes(value.status as string) ||
    value.storage !== "externalArtifact"
  )
    fail("RECORDING_INVALID", "Recording must identify a sealed external artifact");
  integer(value.frameCount, 1, 36000, "recording.frameCount");
  finite(value.durationSeconds, 0, 600, "recording.durationSeconds");
  return value as unknown as RecordingReference;
}

function validateBehaviorReferences(
  document: SoundBehaviorDocument,
  project: ProjectDocument,
): void {
  const assetMap = new Map(project.assets.map((a) => [a.assetId, a]));
  const pins = new Map<string, { revision: number; sha256: string }>();
  for (const pin of document.assets) {
    if (pins.has(pin.assetId)) fail("DUPLICATE_ASSET", `Duplicate behavior pin ${pin.assetId}`);
    pins.set(pin.assetId, pin);
    const asset = assetMap.get(pin.assetId);
    if (!asset) fail("ASSET_MISSING", `Missing project asset ${pin.assetId}`);
    if (asset.revision !== pin.revision) fail("ASSET_REVISION", `Stale asset ${pin.assetId}`);
    if (asset.sha256 !== pin.sha256) fail("ASSET_HASH", `Asset hash differs ${pin.assetId}`);
  }
  const profiles = new Map(document.profiles.map((p) => [p.profileId, p]));
  if (profiles.size !== document.profiles.length)
    fail("BEHAVIOR_INVALID", "Duplicate profile identity");
  const bindingIds = new Set<string>();
  const objects = new Set(project.scene.objects.map((o) => o.id));
  for (const binding of document.bindings) {
    if (bindingIds.has(binding.bindingId)) fail("BEHAVIOR_INVALID", "Duplicate binding identity");
    bindingIds.add(binding.bindingId);
    if (!objects.has(binding.objectId))
      fail("BINDING_OBJECT", `Unknown bound object ${binding.objectId}`);
    const profile = profiles.get(binding.profileId);
    if (!profile || profile.revision !== binding.profileRevision)
      fail("BEHAVIOR_INVALID", "Missing or stale profile reference");
    const rules = new Set(profile.rules.map((r) => r.ruleId));
    if (
      binding.overrides.some((o) => !rules.has(o.ruleId)) ||
      new Set(binding.overrides.map((o) => o.ruleId)).size !== binding.overrides.length
    )
      fail("BEHAVIOR_INVALID", "Invalid rule override reference");
  }
  const generatorPin = (generator: SoundGenerator): void => {
    if (generator.kind !== "sample") return;
    const pin = pins.get(generator.asset.assetId);
    if (!pin || pin.revision !== generator.asset.revision || pin.sha256 !== generator.asset.sha256)
      fail("ASSET_MISSING", "Generator asset is not pinned");
  };
  for (const profile of profiles.values()) {
    if (new Set(profile.rules.map((r) => r.ruleId)).size !== profile.rules.length)
      fail("BEHAVIOR_INVALID", "Duplicate rule identity");
    for (const rule of profile.rules) {
      generatorPin(rule.generator);
      if (
        rule.trigger.kind === "discrete" &&
        rule.generator.kind === "oscillator" &&
        !rule.lifecycle &&
        rule.oneShotDurationSeconds === undefined
      )
        fail("BEHAVIOR_INVALID", "One-shot oscillators require a finite duration");
    }
    for (const override of profile.materialPairOverrides) {
      if (!profile.rules.some((r) => r.ruleId === override.ruleId))
        fail("BEHAVIOR_INVALID", "Material override refers to a missing rule");
      generatorPin(override.generator);
    }
  }
  for (const source of project.scene.sources)
    if (!assetMap.has(source.signalId))
      fail("ASSET_MISSING", `Unknown source signal ${source.signalId}`);
}

export function validateProject(input: unknown): ProjectDocument {
  assertProjectJson(input);
  const value = object(input, "project");
  fields(
    value,
    [
      "schemaVersion",
      "projectId",
      "revision",
      "name",
      "createdAt",
      "updatedAt",
      "scene",
      "soundBehaviors",
      "assets",
      "recordings",
      "activeRecordingId",
      "editorMetadata",
    ],
    "project",
  );
  if (value.schemaVersion !== "1.0.0") fail("VERSION", "Unsupported project schema version");
  id(value.projectId, "projectId");
  integer(value.revision, 0, 2147483647, "revision");
  text(value.name, 256, "name");
  timestamp(value.createdAt, "createdAt");
  timestamp(value.updatedAt, "updatedAt");
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt))
    fail("PROJECT_INVALID", "updatedAt precedes createdAt");
  let scene;
  try {
    scene = createScene(value.scene);
  } catch (error) {
    fail("SCENE_INVALID", error instanceof Error ? error.message : "Invalid scene");
  }
  const editorMetadata = Object.hasOwn(value, "editorMetadata")
    ? validateEditorMetadata(value.editorMetadata, scene)
    : undefined;
  if (!behaviorValidator(value.soundBehaviors))
    fail("BEHAVIOR_INVALID", JSON.stringify(behaviorValidator.errors));
  if (
    !Array.isArray(value.assets) ||
    value.assets.length > 256 ||
    !Array.isArray(value.recordings) ||
    value.recordings.length > 100
  )
    fail("SIZE_LIMIT", "Asset/recording list exceeds limits");
  const assets = value.assets.map(validateAsset),
    recordings = value.recordings.map(validateRecording);
  if (new Set(assets.map((a) => a.assetId)).size !== assets.length)
    fail("DUPLICATE_ASSET", "Duplicate project asset identity");
  if (new Set(recordings.map((r) => r.runId)).size !== recordings.length)
    fail("RECORDING_INVALID", "Duplicate recording identity");
  if (value.activeRecordingId !== undefined) {
    id(value.activeRecordingId, "activeRecordingId");
    if (!recordings.some((recording) => recording.runId === value.activeRecordingId))
      fail("RECORDING_INVALID", "activeRecordingId must reference an existing recording runId");
  }
  const project = {
    ...value,
    scene,
    assets,
    recordings,
    ...(editorMetadata === undefined ? {} : { editorMetadata }),
  } as ProjectDocument;
  validateBehaviorReferences(project.soundBehaviors, project);
  try {
    validateBehaviorAuthoring(project.soundBehaviors, {
      sceneRevision: project.scene.sceneRevision,
      objects: project.scene.objects.map((item) => ({ objectId: item.id, generation: 1 })),
      materialIds: [
        ...new Set(
          project.scene.objects.flatMap((item) => [
            item.physicsMaterialId,
            item.acousticMaterialId,
          ]),
        ),
      ],
      zoneIds: [],
      assetRegistry: assets.map((asset) => ({
        assetId: asset.assetId,
        revision: asset.revision,
        sha256: asset.sha256,
        availability: "MISSING",
        rightsStatus: "UNVERIFIED",
      })),
      validationMode: "product",
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${"code" in error ? String(error.code) + ": " : ""}${error.message}`
        : "Invalid authoring domain";
    fail("BEHAVIOR_INVALID", detail);
  }
  return structuredClone(project);
}
