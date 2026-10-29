import { readFileSync, existsSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const populated = (v) => typeof v === "string" && v.trim().length > 0;
export function validateLedger(ledger) {
  const errors = [];
  if (!ledger || typeof ledger !== "object") return ["ledger must be an object"];
  for (const key of ["schema_version", "review_date", "scope"])
    if (!populated(ledger[key])) errors.push(`missing ${key}`);
  if (!Array.isArray(ledger.sources) || !Array.isArray(ledger.claims))
    return [...errors, "sources and claims must be arrays"];
  if (ledger.sources.length < 15)
    errors.push("at least 15 reviewed core sources required by bootstrap request");
  const sources = new Set();
  for (const source of ledger.sources) {
    if (sources.has(source.id)) errors.push(`duplicate source ${source.id}`);
    sources.add(source.id);
    for (const key of [
      "id",
      "title",
      "url",
      "publication_type",
      "access_level",
      "evidence_locator",
      "review_date",
    ])
      if (!populated(source[key])) errors.push(`source ${source.id}: missing ${key}`);
    if (
      !(typeof source.authors === "string" || Array.isArray(source.authors)) ||
      !source.authors.length
    )
      errors.push(`source ${source.id}: missing authors`);
    // Explicit null is permitted for undated official web documentation; never invent a year.
    if (!(source.year === null || typeof source.year === "number" || populated(source.year)))
      errors.push(`source ${source.id}: missing year`);
    if (source.artifact_path !== undefined) {
      const path = source.artifact_path;
      if (
        !populated(path) ||
        path !== source.url ||
        isAbsolute(path) ||
        /^[a-z]:/i.test(path) ||
        path.split(/[\\/]/).includes("..") ||
        !existsSync(path) ||
        !statSync(path).isFile()
      )
        errors.push(`source ${source.id}: invalid or missing repository artifact`);
    } else {
      try {
        if (!["http:", "https:"].includes(new URL(source.url).protocol))
          errors.push(`source ${source.id}: unsupported URL`);
      } catch {
        errors.push(`source ${source.id}: invalid URL (local evidence needs artifact_path)`);
      }
    }
  }
  const claims = new Set();
  for (const claim of ledger.claims) {
    if (claims.has(claim.id)) errors.push(`duplicate claim ${claim.id}`);
    claims.add(claim.id);
    for (const key of ["id", "claim", "evidence_type", "verification_status"])
      if (!populated(claim[key])) errors.push(`claim ${claim.id}: missing ${key}`);
    for (const key of ["applicable_conditions", "related_implementation", "limitations"])
      if (!(populated(claim[key]) || (Array.isArray(claim[key]) && claim[key].length)))
        errors.push(`claim ${claim.id}: missing ${key}`);
    if (!Array.isArray(claim.source_ids) || !claim.source_ids.length)
      errors.push(`claim ${claim.id}: no sources`);
    else
      for (const id of claim.source_ids)
        if (!sources.has(id)) errors.push(`claim ${claim.id}: unknown source ${id}`);
  }
  return errors;
}
export function validateFixtureReferences(deck, ledger) {
  const ids = new Set(ledger.claims?.map((claim) => claim.id));
  const errors = [];
  for (const fixture of deck.fixtures ?? []) {
    for (const id of fixture.referenceClaimIds ?? [])
      if (!ids.has(id)) errors.push(`fixture ${fixture.id}: unknown evidence claim ${id}`);
  }
  return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const ledger = JSON.parse(readFileSync("research/EVIDENCE_LEDGER.json", "utf8"));
    const deck = JSON.parse(readFileSync("benchmarks/fixtures/analytical.json", "utf8"));
    const errors = [...validateLedger(ledger), ...validateFixtureReferences(deck, ledger)];
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else
      console.log(
        `PASS research metadata: ${ledger.sources.length} sources, ${ledger.claims.length} claims, ${deck.fixtures.length} fixture references. Source content/license verification remains the research ledger's review task.`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
