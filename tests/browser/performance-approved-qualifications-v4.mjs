import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const recordPath =
  "docs/16-nonadvanced-completion/lanes/performance/VERSIONED_APPROVAL_RECORD-V4-SEMANTIC-03.json";
const recordSha256 = "a9b46674b9e5225ba138f4f8014364d3c408f496946c0fe2236c5a5718a7824a";
const allowedScope = "FORMAL_V4_SEMANTIC_PRECONDITION";
const expectedId = "semantic-v3-c59df8c64fdfa846d6e22daf";
const inputKeys = [
  "qualificationId",
  "executableSha256",
  "producerRevision",
  "sourcePins",
  "requiredScope",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const revision = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const fail = (reason) => {
  throw new Error(`V4_QUALIFICATION_${reason}`);
};
const owns = (value, name) => Object.hasOwn(value, name);

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function validRelativePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    !/[\\\u0000-\u001f\u007f<>:"|?*]/.test(value) &&
    !path.posix.isAbsolute(value) &&
    value === path.posix.normalize(value) &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}
function pinMap(pins, { expectedCount = null, requireBytes = false } = {}) {
  if (!Array.isArray(pins) || (expectedCount !== null && pins.length !== expectedCount))
    fail("SOURCE_PIN_MANIFEST_SCHEMA");
  const result = new Map();
  for (const pin of pins) {
    if (
      !object(pin) ||
      Object.keys(pin).some((key) => !["path", "sha256", "bytes"].includes(key)) ||
      !owns(pin, "path") ||
      !owns(pin, "sha256") ||
      !validRelativePath(pin.path) ||
      !sha256(pin.sha256) ||
      ((requireBytes || owns(pin, "bytes")) && (!Number.isSafeInteger(pin.bytes) || pin.bytes < 0))
    )
      fail("SOURCE_PIN_SCHEMA");
    if (result.has(pin.path)) fail("DUPLICATE_SOURCE_PIN");
    result.set(pin.path, pin);
  }
  return result;
}
function validateCanonicalRecord(record) {
  if (
    !object(record) ||
    record.schemaVersion !== 1 ||
    record.status !== "APPROVED" ||
    record.scope !== allowedScope ||
    record.qualificationId !== expectedId ||
    record.authority?.kind !== "ROOT_EXPLICIT_ADOPTION" ||
    !revision(record.authority?.atCommit) ||
    !revision(record.runSourceCommit) ||
    !revision(record.evidenceCommit) ||
    !revision(record.producerRevision) ||
    !sha256(record.executableSha256) ||
    record.requiredSourceCount !== 44 ||
    !object(record.executionAuthorization) ||
    Object.values(record.executionAuthorization).some((value) => value !== false)
  )
    fail("APPROVAL_RECORD_SCHEMA_OR_SCOPE");
  pinMap(record.requiredSourcePins, { expectedCount: 44, requireBytes: true });
  pinMap(record.evidencePins, { expectedCount: 7, requireBytes: true });
  if (
    record.semanticEvidence?.pilotSucceeded !== true ||
    !object(record.semanticEvidence?.fiveGates) ||
    ![
      "journal",
      "strictNative",
      "fullNativeSet",
      "capturedBootstrap",
      "unchangedNumericComplete",
    ].every((key) => record.semanticEvidence.fiveGates[key] === true)
  )
    fail("APPROVAL_RECORD_SEMANTIC_EVIDENCE");
  return record;
}
async function readCanonicalRecord() {
  let bytes;
  try {
    bytes = await readFile(path.join(root, recordPath));
  } catch (cause) {
    throw new Error("V4_QUALIFICATION_APPROVAL_RECORD_UNAVAILABLE", { cause });
  }
  if (hash(bytes) !== recordSha256) fail("APPROVAL_RECORD_HASH_MISMATCH");
  let record;
  try {
    record = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    throw new Error("V4_QUALIFICATION_APPROVAL_RECORD_JSON", { cause });
  }
  return validateCanonicalRecord(record);
}
async function verifyEvidencePins(record) {
  await Promise.all(
    record.evidencePins.map(async (pin) => {
      let bytes;
      try {
        bytes = await readFile(path.join(root, pin.path));
      } catch (cause) {
        throw new Error(`V4_QUALIFICATION_EVIDENCE_UNAVAILABLE:${pin.path}`, { cause });
      }
      if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256)
        fail(`EVIDENCE_PIN_MISMATCH:${pin.path}`);
    }),
  );
}

// Metadata for planning only. Every resolution below re-reads and verifies the
// canonical authority bytes; a cached entry or caller flag cannot approve a run.
export const APPROVED_QUALIFICATIONS_V4 = deepFreeze([await readCanonicalRecord()]);

export async function resolveApprovedQualificationV4(input) {
  const record = await readCanonicalRecord();
  if (
    !object(input) ||
    Object.keys(input).length !== inputKeys.length ||
    !inputKeys.every((key) => owns(input, key))
  )
    fail("INPUT_SCHEMA");
  if (input.qualificationId !== record.qualificationId) fail("NOT_APPROVED");
  if (input.requiredScope !== allowedScope) fail("SCOPE_NOT_APPROVED");
  if (!sha256(input.executableSha256) || input.executableSha256 !== record.executableSha256)
    fail("EXECUTABLE_PIN_MISMATCH");
  if (!revision(input.producerRevision) || input.producerRevision !== record.producerRevision)
    fail("PRODUCER_PIN_MISMATCH");
  const actual = pinMap(input.sourcePins);
  for (const pin of record.requiredSourcePins) {
    const observed = actual.get(pin.path);
    if (
      !observed ||
      observed.sha256 !== pin.sha256 ||
      (owns(observed, "bytes") && observed.bytes !== pin.bytes)
    )
      fail(`SOURCE_PIN_MISMATCH:${pin.path}`);
  }
  await verifyEvidencePins(record);
  // This is semantic precondition approval only, never a browser lease, 600s,
  // product GUI, lossless CPU, native-exclusive DSP, device, or hearing approval.
  return deepFreeze(record);
}
