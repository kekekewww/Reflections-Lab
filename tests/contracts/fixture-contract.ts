import { readFileSync } from "node:fs";

/** Runtime JSON remains untrusted until the validator checks its full shape. */
export interface AnalyticalFixture {
  id: string;
  kind: string;
  evidenceType: "DERIVED" | "SYNTHETIC";
  input: Record<string, unknown>;
  units: Record<string, string>;
  expected: Record<string, unknown>;
  referenceClaimIds: string[];
  tolerance: { absolute: number; explanation: string };
  reproduction: string;
}

export const readFixtureDocument = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8")) as unknown;

export function assertFixture(value: unknown): asserts value is AnalyticalFixture {
  if (typeof value !== "object" || value === null) throw new TypeError("fixture must be an object");
  const item = value as Partial<AnalyticalFixture>;
  if (
    !item.id ||
    !item.kind ||
    !item.input ||
    !item.expected ||
    !item.units ||
    !Array.isArray(item.referenceClaimIds) ||
    !item.tolerance ||
    !Number.isFinite(item.tolerance.absolute) ||
    item.tolerance.absolute < 0 ||
    !["DERIVED", "SYNTHETIC"].includes(item.evidenceType ?? "") ||
    !item.reproduction
  ) {
    throw new TypeError("invalid analytical fixture metadata");
  }
}
