import { MUTATION_TOOLS, type ToolRequest } from "../ai/types.js";
import { validateToolRequest } from "../ai/validation.js";
import { createScene } from "../scene/validate-scene.js";
import type { SceneSpec } from "../scene/types.js";
import { ProjectError, type ProjectEditorMetadata } from "./types.js";
const MAX_REVISION = 2147483647;
function fail(code: string, message: string): never {
  throw new ProjectError(code, message);
}
function object(
  input: unknown,
  allowed: readonly string[],
  label: string,
): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    fail("EDITOR_METADATA_INVALID", `${label} must be a plain object`);
  if (Object.getOwnPropertySymbols(input).length)
    fail("EDITOR_METADATA_INVALID", `${label} cannot contain symbols`);
  for (const key of Object.getOwnPropertyNames(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
    if (!allowed.includes(key) || !descriptor.enumerable || !("value" in descriptor))
      fail("EDITOR_METADATA_INVALID", `${label}.${key} is unknown or not inert JSON`);
  }
  return input as Record<string, unknown>;
}
function array(input: unknown, max: number, label: string): unknown[] {
  if (
    !Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Array.prototype ||
    input.length > max ||
    Object.getOwnPropertySymbols(input).length
  )
    fail("EDITOR_METADATA_INVALID", `${label} must be a bounded plain array`);
  const names = Object.getOwnPropertyNames(input);
  if (names.length !== input.length + 1)
    fail("EDITOR_METADATA_INVALID", `${label} cannot be sparse or have named properties`);
  for (let index = 0; index < input.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
      fail("EDITOR_METADATA_INVALID", `${label} must contain inert values`);
  }
  return input;
}
function stableId(input: unknown, label: string): asserts input is string {
  if (typeof input !== "string" || !/^[a-z][a-z0-9._-]{0,63}$/.test(input))
    fail("EDITOR_METADATA_INVALID", `${label} must be a Scene stable ID`);
}
function labelText(input: unknown, label: string): asserts input is string {
  if (typeof input !== "string" || input.length < 1 || input.length > 160)
    fail("EDITOR_METADATA_INVALID", `${label} must contain 1..160 characters`);
}
function parse(input: unknown): ProjectEditorMetadata {
  const value = object(
    input,
    ["schemaVersion", "revision", "sceneLabel", "objectLabels", "sourceReferences"],
    "editorMetadata",
  );
  if (
    value.schemaVersion !== "1.0.0" ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    (value.revision as number) > MAX_REVISION
  )
    fail("EDITOR_METADATA_INVALID", "Unsupported editor metadata version or revision");
  if (Object.hasOwn(value, "sceneLabel")) labelText(value.sceneLabel, "editorMetadata.sceneLabel");
  const objectIds = new Set<string>(),
    sourceIds = new Set<string>();
  const objectLabels = array(value.objectLabels, 256, "editorMetadata.objectLabels").map(
    (input) => {
      const row = object(input, ["objectId", "label"], "objectLabel");
      stableId(row.objectId, "objectLabel.objectId");
      labelText(row.label, "objectLabel.label");
      if (objectIds.has(row.objectId))
        fail("EDITOR_METADATA_INVALID", "Duplicate object label identity");
      objectIds.add(row.objectId);
      return { objectId: row.objectId, label: row.label };
    },
  );
  const sourceReferences = array(value.sourceReferences, 32, "editorMetadata.sourceReferences").map(
    (input) => {
      const row = object(input, ["sourceId", "referenceFrequencyHz"], "sourceReference");
      stableId(row.sourceId, "sourceReference.sourceId");
      if (
        typeof row.referenceFrequencyHz !== "number" ||
        !Number.isFinite(row.referenceFrequencyHz) ||
        row.referenceFrequencyHz < 20 ||
        row.referenceFrequencyHz > 20000
      )
        fail("EDITOR_METADATA_INVALID", "Reference frequency must be finite and in 20..20000Hz");
      if (sourceIds.has(row.sourceId))
        fail("EDITOR_METADATA_INVALID", "Duplicate source reference identity");
      sourceIds.add(row.sourceId);
      return { sourceId: row.sourceId, referenceFrequencyHz: row.referenceFrequencyHz };
    },
  );
  return {
    schemaVersion: "1.0.0",
    revision: value.revision as number,
    ...(Object.hasOwn(value, "sceneLabel") ? { sceneLabel: value.sceneLabel as string } : {}),
    objectLabels,
    sourceReferences,
  };
}
function references(metadata: ProjectEditorMetadata, scene: SceneSpec): void {
  const objects = new Set(scene.objects.map((object) => object.id)),
    sources = new Set(scene.sources.map((source) => source.id));
  if (
    metadata.objectLabels.some((row) => !objects.has(row.objectId)) ||
    metadata.sourceReferences.some((row) => !sources.has(row.sourceId))
  )
    fail(
      "EDITOR_METADATA_REFERENCE",
      "Editor metadata must reference existing Scene object/source IDs",
    );
}
export function validateEditorMetadata(
  input: unknown,
  sceneInput: SceneSpec,
): ProjectEditorMetadata {
  const metadata = parse(input),
    scene = createScene(sceneInput);
  references(metadata, scene);
  return metadata;
}
const empty = (): ProjectEditorMetadata => ({
  schemaVersion: "1.0.0",
  revision: 0,
  objectLabels: [],
  sourceReferences: [],
});
function prune(metadata: ProjectEditorMetadata, scene: SceneSpec): ProjectEditorMetadata {
  return {
    ...metadata,
    objectLabels: metadata.objectLabels.filter((row) =>
      scene.objects.some((object) => object.id === row.objectId),
    ),
    sourceReferences: metadata.sourceReferences.filter((row) =>
      scene.sources.some((source) => source.id === row.sourceId),
    ),
  };
}
function changed(before: ProjectEditorMetadata, after: ProjectEditorMetadata): boolean {
  const { revision: _before, ...a } = before,
    { revision: _after, ...b } = after;
  return JSON.stringify(a) !== JSON.stringify(b);
}
function advance(metadata: ProjectEditorMetadata): ProjectEditorMetadata {
  if (metadata.revision >= MAX_REVISION)
    fail("EDITOR_METADATA_REVISION", "Editor metadata revision is exhausted");
  return { ...metadata, revision: metadata.revision + 1 };
}
/** Prune removed Scene identities; unchanged metadata and absent legacy state keep their revision/absence. */
export function reconcileEditorMetadata(
  metadata: ProjectEditorMetadata | undefined,
  sceneInput: SceneSpec,
): ProjectEditorMetadata | undefined {
  const scene = createScene(sceneInput);
  if (metadata === undefined) return undefined;
  const before = parse(metadata),
    next = prune(before, scene);
  references(next, scene);
  return changed(before, next) ? advance(next) : next;
}
/** Preserve approved authoring/provenance fields outside frozen Scene v1. Frequency is not a measured resonance. */
export function projectEditorMetadata(
  metadata: ProjectEditorMetadata | undefined,
  sceneInput: SceneSpec,
  approvedToolRequests: readonly ToolRequest[],
): ProjectEditorMetadata | undefined {
  const scene = createScene(sceneInput),
    requests = array(approvedToolRequests, 32, "approvedToolRequests").map(validateToolRequest);
  const ids = new Set<string>(),
    added = new Set<string>(),
    configured = new Set<string>();
  for (const request of requests) {
    if (!(MUTATION_TOOLS as readonly string[]).includes(request.tool))
      fail(
        "EDITOR_METADATA_TOOL",
        "Only approved Scene mutation requests can project editor metadata",
      );
    if (
      request.sceneId !== scene.sceneId ||
      request.expectedSceneRevision !== scene.sceneRevision - 1
    )
      fail(
        "REVISION_CONFLICT",
        "Approved editor metadata requests do not belong to the next Scene revision",
      );
    if (ids.has(request.requestId)) fail("EDITOR_METADATA_TOOL", "Duplicate approved request ID");
    ids.add(request.requestId);
    if (request.tool === "CreateScene" && requests.length !== 1)
      fail("EDITOR_METADATA_TOOL", "CreateScene must be projected alone");
    if (request.tool === "AddObject") {
      const objectId = request.arguments.objectId as string;
      if (added.has(objectId))
        fail("EDITOR_METADATA_TOOL", "An object can be added only once per metadata transaction");
      added.add(objectId);
      if (!scene.objects.some((object) => object.id === objectId))
        fail("EDITOR_METADATA_REFERENCE", "Approved AddObject was not applied to this Scene");
    }
    if (request.tool === "ConfigureSoundSource") {
      const args = request.arguments,
        sourceId = args.sourceId as string,
        source = scene.sources.find((source) => source.id === sourceId);
      if (configured.has(sourceId))
        fail(
          "EDITOR_METADATA_TOOL",
          "A source can be configured only once per metadata transaction",
        );
      configured.add(sourceId);
      if (
        !source ||
        source.objectId !== args.objectId ||
        source.signalId !== args.signalId ||
        source.mode !== args.mode ||
        source.gainDbfs !== args.gainDbfs
      )
        fail(
          "EDITOR_METADATA_REFERENCE",
          "Approved source configuration was not applied to this Scene",
        );
    }
  }
  const before = metadata === undefined ? empty() : parse(metadata);
  let next = prune(before, scene),
    reset = false;
  for (const request of requests) {
    const args = request.arguments;
    if (request.tool === "CreateScene") {
      next = {
        schemaVersion: "1.0.0",
        revision: before.revision,
        sceneLabel: args.label as string,
        objectLabels: [],
        sourceReferences: [],
      };
      reset = true;
    } else if (request.tool === "AddObject") {
      const row = { objectId: args.objectId as string, label: args.label as string };
      next.objectLabels = next.objectLabels.some((value) => value.objectId === row.objectId)
        ? next.objectLabels.map((value) => (value.objectId === row.objectId ? row : value))
        : [...next.objectLabels, row];
    } else if (request.tool === "ConfigureSoundSource") {
      const row = {
        sourceId: args.sourceId as string,
        referenceFrequencyHz: args.referenceFrequencyHz as number,
      };
      next.sourceReferences = next.sourceReferences.some((value) => value.sourceId === row.sourceId)
        ? next.sourceReferences.map((value) => (value.sourceId === row.sourceId ? row : value))
        : [...next.sourceReferences, row];
    }
  }
  next = validateEditorMetadata(next, scene);
  if (!reset && !changed(before, next)) return metadata === undefined ? undefined : next;
  return advance(next);
}
