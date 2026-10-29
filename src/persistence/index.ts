import { assertProjectJson, MAX_PROJECT_BYTES, validateProject } from "./validate-project.js";
import { ProjectError, type ProjectDocument, type StorageAdapter } from "./types.js";
export * from "./types.js";
export { MAX_PROJECT_BYTES, validateProject } from "./validate-project.js";

/** Creates initial metadata only; it does not activate physics or decode assets. */
export function createProject(input: unknown): ProjectDocument {
  assertProjectJson(input);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ProjectError("PROJECT_INVALID", "Project input must be an object");
  const value = input as Record<string, unknown>;
  const createdAt = value.createdAt ?? new Date().toISOString();
  return validateProject({
    schemaVersion: "1.0.0",
    revision: 0,
    recordings: [],
    ...value,
    createdAt,
    updatedAt: value.updatedAt ?? createdAt,
  });
}

export function serializeProject(project: ProjectDocument): string {
  const text = JSON.stringify(validateProject(project), null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES)
    throw new ProjectError("SIZE_LIMIT", "Formatted project exceeds byte budget");
  return text;
}

export function deserializeProject(text: string): ProjectDocument {
  if (typeof text !== "string") throw new ProjectError("JSON_INVALID", "Project JSON must be text");
  if (
    text.length > MAX_PROJECT_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES
  )
    throw new ProjectError("SIZE_LIMIT", "Project JSON exceeds byte budget");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new ProjectError("JSON_INVALID", "Project JSON could not be parsed");
  }
  return validateProject(input);
}

/** Stored references do not prove that external audio bytes are present or decoded. */
export function unresolvedProjectAssets(
  project: ProjectDocument,
  available: ReadonlyMap<string, { revision: number; sha256: string }> = new Map(),
): string[] {
  return project.assets
    .filter((asset) => {
      const local = available.get(asset.assetId);
      return !local || local.revision !== asset.revision || local.sha256 !== asset.sha256;
    })
    .map((asset) => asset.assetId);
}

/** One-key commit is atomic within the storage adapter; no cross-tab locking is claimed. */
export class ProjectStore {
  private current: ProjectDocument | null = null;
  private readonly storage: StorageAdapter;
  private readonly key: string;
  constructor(storage: StorageAdapter, key = "reflection-lab.project.v1") {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function")
      throw new ProjectError("STORAGE_INVALID", "A storage adapter is required");
    if (!key || key.length > 128)
      throw new ProjectError("STORAGE_INVALID", "Storage key must be bounded");
    this.storage = storage;
    this.key = key;
  }
  getCurrent(): ProjectDocument | null {
    return this.current ? structuredClone(this.current) : null;
  }
  save(project: ProjectDocument, options: { expectedRevision?: number } = {}): ProjectDocument {
    const candidate = validateProject(project);
    let previous: string | null;
    try {
      previous = this.storage.getItem(this.key);
    } catch {
      throw new ProjectError("STORAGE_READ", "Stored project could not be read");
    }
    const durable = previous === null ? null : deserializeProject(previous);
    if (
      options.expectedRevision !== undefined &&
      (!Number.isSafeInteger(options.expectedRevision) ||
        (durable?.revision ?? null) !== options.expectedRevision)
    )
      throw new ProjectError("REVISION_CONFLICT", "Stored project revision changed");
    const text = serializeProject(candidate);
    if (
      durable?.projectId === candidate.projectId &&
      candidate.revision <= durable.revision &&
      serializeProject(durable) !== text
    )
      throw new ProjectError("REVISION_CONFLICT", "Changed project must advance revision");
    try {
      this.storage.setItem(this.key, text);
    } catch {
      throw new ProjectError(
        "STORAGE_WRITE",
        "Project could not be committed; previous in-memory project retained",
      );
    }
    this.current = candidate;
    return structuredClone(candidate);
  }
  load(): ProjectDocument | null {
    let text: string | null;
    try {
      text = this.storage.getItem(this.key);
    } catch {
      throw new ProjectError("STORAGE_READ", "Stored project could not be read");
    }
    if (text === null) return null;
    const candidate = deserializeProject(text);
    this.current = candidate;
    return structuredClone(candidate);
  }
  import(text: string): ProjectDocument {
    const candidate = deserializeProject(text);
    this.current = candidate;
    return structuredClone(candidate);
  }
  export(): string {
    if (!this.current) throw new ProjectError("PROJECT_MISSING", "There is no loaded project");
    return serializeProject(this.current);
  }
}
