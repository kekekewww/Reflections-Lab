// Versioned attribution derivative. The immutable original V2 module is unchanged.
export function metric(id, values, threshold = null) {
  const raw = values
      .filter((value) => typeof value === "number" && Number.isFinite(value))
      .sort((a, b) => a - b),
    n = raw.length;
  const quantile = (fraction) => (n ? raw[Math.min(n - 1, Math.ceil(n * fraction) - 1)] : null);
  return {
    id,
    unit: "ms",
    count: n,
    requestedCount: values.length,
    unobservedCount: values.length - n,
    p50: quantile(0.5),
    p95: quantile(0.95),
    p99: quantile(0.99),
    max: n ? raw[n - 1] : null,
    thresholdP95LessThan: threshold,
    exceedanceCount:
      threshold === null || n === 0 ? null : raw.filter((value) => value >= threshold).length,
    status:
      n === 0
        ? "NOT_RUN"
        : threshold === null
          ? "MEASURED"
          : quantile(0.95) >= threshold
            ? "FAIL"
            : n < values.length
              ? "UNVERIFIED"
              : "PASS",
  };
}
