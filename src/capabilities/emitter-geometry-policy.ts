export const EMITTER_GEOMETRY_POLICY = "explicit-emitter-body-v1" as const;

/** Every new capture pins the caller policy, including object/contact-only A runs. */
export function emitterGeometryPolicyPin(): {
  emitterGeometryPolicy: typeof EMITTER_GEOMETRY_POLICY;
} {
  return { emitterGeometryPolicy: EMITTER_GEOMETRY_POLICY };
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Read JSON data properties only: a metadata check never executes supplied accessors. */
function dataProperty(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function hasDetachedEmitter(document: unknown): boolean {
  if (!plainRecord(document)) return false;
  const profiles = dataProperty(document, "profiles");
  if (!Array.isArray(profiles)) return false;
  for (const profile of profiles) {
    if (!plainRecord(profile)) continue;
    const rules = dataProperty(profile, "rules");
    if (!Array.isArray(rules)) continue;
    for (const rule of rules) {
      if (!plainRecord(rule)) continue;
      const emitter = dataProperty(rule, "emitter");
      if (!plainRecord(emitter)) continue;
      const attachment = dataProperty(emitter, "attachment");
      if (attachment === "fixed" || attachment === "zone") return true;
    }
  }
  return false;
}

/**
 * Compatibility gate only, not a substitute for document/configuration validation.
 * Legacy object/contact artifacts remain unmodified; affected detached baselines
 * need an explicit current policy before their motion may be reevaluated.
 */
export function hasCurrentEmitterGeometryPolicy(document: unknown, solverConfig: unknown): boolean {
  const required = hasDetachedEmitter(document);
  if (solverConfig === undefined || solverConfig === null) return !required;
  if (!plainRecord(solverConfig)) return false;
  if (!Object.prototype.hasOwnProperty.call(solverConfig, "emitterGeometryPolicy"))
    return !required;
  return dataProperty(solverConfig, "emitterGeometryPolicy") === EMITTER_GEOMETRY_POLICY;
}
