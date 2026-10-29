import { createHash } from "node:crypto";

// Isolated policy feasibility model. Thresholds are Tuned/Synthetic test inputs,
// not measured physical constants or the production sound/physics bridge.
function vector(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((v) => !Number.isFinite(v)))
    throw new Error("Invalid finite Vec3");
  return value;
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const tangent = (v, n) => v.map((x, i) => x - dot(v, n) * n[i]);
const magnitude = (v) => {
  vector(v);
  const length = Math.hypot(...v);
  if (!Number.isFinite(length)) throw new Error("Numeric range exceeded");
  return length;
};
const identity = (parts) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

export function contactMotion({
  supported,
  shape,
  linearVelocity,
  angularVelocity,
  contactOffset,
  surfaceVelocity,
  surfaceAngularVelocity,
  normal,
  previousKind = null,
}) {
  for (const v of [linearVelocity, angularVelocity, contactOffset, surfaceVelocity, normal])
    vector(v);
  const normalLength = magnitude(normal);
  if (normalLength === 0) throw new Error("Zero contact normal");
  const n = normal.map((v) => v / normalLength);
  if (!supported) return { kind: "UNSUPPORTED", slipSpeedMetresPerSecond: null };
  if (shape !== "sphere") return { kind: "UNCLASSIFIED", slipSpeedMetresPerSecond: null };
  const rotation = cross(angularVelocity, contactOffset);
  vector(rotation);
  const point = linearVelocity.map((v, i) => v + rotation[i]);
  vector(point);
  const slipSpeedMetresPerSecond = magnitude(tangent(sub(point, surfaceVelocity), n));
  if (surfaceAngularVelocity === undefined || surfaceAngularVelocity === null)
    return { kind: "UNCLASSIFIED", slipSpeedMetresPerSecond };
  vector(surfaceAngularVelocity);
  const supportRotation = cross(surfaceAngularVelocity, contactOffset);
  vector(supportRotation);
  const supportVelocityAtCOM = sub(surfaceVelocity, supportRotation);
  vector(supportVelocityAtCOM);
  const relativeTravel = magnitude(tangent(sub(linearVelocity, supportVelocityAtCOM), n));
  const relativeRotation = cross(sub(angularVelocity, surfaceAngularVelocity), contactOffset);
  vector(relativeRotation);
  const surfaceRotation = magnitude(tangent(relativeRotation, n));
  let kind = "RESTING";
  if (relativeTravel >= 0.1 && surfaceRotation >= 0.1) {
    if (slipSpeedMetresPerSecond <= 0.05) kind = "ROLLING";
    else if (slipSpeedMetresPerSecond >= 0.1) kind = "SLIDING";
    else kind = ["ROLLING", "SLIDING"].includes(previousKind) ? previousKind : "UNCLASSIFIED";
  } else if (slipSpeedMetresPerSecond >= 0.1) kind = "SLIDING";
  return { kind, slipSpeedMetresPerSecond };
}

export function movementTransition(wasMoving, speed, { enter = 0.2, exit = 0.1 } = {}) {
  if (
    typeof wasMoving !== "boolean" ||
    !Number.isFinite(speed) ||
    speed < 0 ||
    !Number.isFinite(enter) ||
    !Number.isFinite(exit) ||
    exit < 0 ||
    enter <= exit
  )
    throw new Error("Invalid movement policy");
  const moving = wasMoving ? speed > exit : speed >= enter;
  return { moving, event: moving === wasMoving ? null : moving ? "OnStartMoving" : "OnStopMoving" };
}

export function interactionEvents({ type, accepted, wasHeld, commandId }) {
  if (!accepted || typeof commandId !== "string" || !commandId) return [];
  if (type === "Grab" && !wasHeld) return ["OnGrab"];
  if (!wasHeld) return [];
  if (type === "Throw") return ["OnRelease", "OnThrow"];
  if (type === "Drop") return ["OnRelease", "OnDrop"];
  if (type === "Release") return ["OnRelease"];
  return [];
}

export function impactCandidates(
  { runEpoch, tick, contacts, state },
  { minImpulse = 0.02, minClosingSpeed = 0.15, cooldownTicks = 5, maxGroups = 256 } = {},
) {
  if (
    typeof runEpoch !== "string" ||
    !runEpoch ||
    !Number.isSafeInteger(tick) ||
    tick < 0 ||
    !Array.isArray(contacts) ||
    contacts.length > 256
  )
    throw new Error("Invalid or unbounded contact batch");
  if (
    !Number.isSafeInteger(maxGroups) ||
    maxGroups < 1 ||
    maxGroups > 256 ||
    !Number.isSafeInteger(cooldownTicks) ||
    cooldownTicks < 0 ||
    !Number.isFinite(minImpulse) ||
    minImpulse < 0 ||
    !Number.isFinite(minClosingSpeed) ||
    minClosingSpeed < 0
  )
    throw new Error("Invalid impact policy");
  const prior = state.runEpoch === runEpoch ? (state.lastAudibleByGroup ?? {}) : {};
  const seenEpisodes = state.runEpoch === runEpoch ? (state.seenEpisodes ?? {}) : {};
  if (state.runEpoch === runEpoch && tick < state.lastTick) throw new Error("Out-of-order tick");
  const next = {
      runEpoch,
      lastTick: tick,
      lastAudibleByGroup: { ...prior },
      seenEpisodes: { ...seenEpisodes },
    },
    groups = new Map();
  const seen = new Set();
  for (const c of contacts) {
    for (const key of ["pairKey", "episodeId", "regionId", "contactKey"])
      if (typeof c[key] !== "string" || !c[key] || c[key].length > 256)
        throw new Error("Invalid contact identity");
    vector(c.positionMetres);
    const duplicateKey = identity([c.pairKey, c.episodeId, c.regionId, c.contactKey]);
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    const key = identity([c.pairKey, c.episodeId, c.regionId]);
    let g = groups.get(key);
    if (!g) {
      g = {
        pairKey: c.pairKey,
        episodeId: c.episodeId,
        regionId: c.regionId,
        impulse: 0,
        weighted: [0, 0, 0],
        closing: 0,
        discontinuity: false,
        metricsComplete: true,
      };
      groups.set(key, g);
    }
    g.discontinuity ||= c.discontinuity === true;
    if (c.normalImpulseNewtonSeconds === null || c.closingSpeedMetresPerSecond === null) {
      g.metricsComplete = false;
      continue;
    }
    if (
      !Number.isFinite(c.normalImpulseNewtonSeconds) ||
      c.normalImpulseNewtonSeconds < 0 ||
      !Number.isFinite(c.closingSpeedMetresPerSecond) ||
      c.closingSpeedMetresPerSecond < 0
    )
      throw new Error("Invalid contact metrics");
    g.impulse += c.normalImpulseNewtonSeconds;
    g.closing = Math.max(g.closing, c.closingSpeedMetresPerSecond);
    g.weighted = g.weighted.map((v, i) => v + c.positionMetres[i] * c.normalImpulseNewtonSeconds);
    if (!Number.isFinite(g.impulse)) throw new Error("Numeric range exceeded");
    vector(g.weighted);
  }
  const events = [];
  for (const [key, g] of groups) {
    const audibleKey = identity([g.pairKey, g.regionId]);
    const previous = prior[audibleKey];
    next.seenEpisodes[key] = true;
    if (
      seenEpisodes[key] ||
      g.discontinuity ||
      !g.metricsComplete ||
      g.impulse < minImpulse ||
      g.closing < minClosingSpeed ||
      (previous !== undefined && tick - previous < cooldownTicks)
    )
      continue;
    const point = g.weighted.map((v) => v / g.impulse);
    vector(point);
    events.push({
      eventId: "impact-" + identity([runEpoch, tick, g.pairKey, g.episodeId, g.regionId]),
      trigger: "OnImpact",
      runEpoch,
      tick,
      pairKey: g.pairKey,
      episodeId: g.episodeId,
      regionId: g.regionId,
      normalImpulseNewtonSeconds: g.impulse,
      positionMetres: point,
    });
    next.lastAudibleByGroup[audibleKey] = tick;
  }
  if (
    Object.keys(next.lastAudibleByGroup).length > maxGroups ||
    Object.keys(next.seenEpisodes).length > maxGroups
  )
    throw new Error("Policy state budget exceeded");
  return { events, state: next };
}
