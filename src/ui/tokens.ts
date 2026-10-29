import type { CSSProperties } from "react";
import tokenDocument from "../../docs/05-ux/DESIGN_TOKENS.json" with { type: "json" };

/** The canonical design document is the only source of visual token values. */
export const canonicalTokens = tokenDocument.groups;
const kebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
function flatten(
  value: unknown,
  path: string[] = [],
  result: Record<string, string | number> = {},
) {
  if (!value || typeof value !== "object") return result;
  const entry = value as Record<string, unknown>;
  if ("$value" in entry) {
    const raw = entry.$value;
    const formatted = Array.isArray(raw) ? `cubic-bezier(${raw.join(",")})` : raw;
    if (typeof formatted === "string" || typeof formatted === "number") {
      result[`--${path.map(kebab).join("-")}`] = formatted;
    }
  } else {
    for (const [key, child] of Object.entries(entry)) flatten(child, [...path, key], result);
  }
  return result;
}
export const designTokenStyle = flatten(canonicalTokens) as CSSProperties;
