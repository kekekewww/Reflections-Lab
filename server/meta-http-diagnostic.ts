export interface MetaHttpDiagnostic {
  kind: "TYPED_PROVIDER_ERROR" | "UNAVAILABLE";
  code: string | null;
  type: string | null;
  param: string | null;
  message: string | null;
}

/** Retains four bounded diagnostic fields, never a body, header or nested context. */
export function sanitizeMetaHttpDiagnostic(value: unknown, apiKey: string): MetaHttpDiagnostic {
  const root =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const candidate = root.error;
  const error =
    candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>)
      : {};
  const clean = (input: unknown, limit: number): string | null => {
    if (typeof input !== "string") return null;
    // Redact before truncating, including credentials placed across the limit boundary.
    let output = apiKey ? input.split(apiKey).join("[REDACTED]") : input;
    output = output.replace(/LLM_[^\s"'<>\\]*/gi, "[REDACTED]");
    output = output.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    if (!output) return null;
    return output.slice(0, limit);
  };
  const fields = {
    code: clean(error.code, 96),
    type: clean(error.type, 96),
    param: clean(error.param, 256),
    message: clean(error.message, 768),
  };
  return {
    kind: Object.values(fields).some((field) => field !== null)
      ? "TYPED_PROVIDER_ERROR"
      : "UNAVAILABLE",
    ...fields,
  };
}
