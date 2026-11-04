export const TOLERANCE = 2e-6;
export function verifyPcm(reference, candidate) {
  if (reference.length === 0 || reference.length !== candidate.length || reference.length % 4)
    throw Error("PCM_LENGTH");
  const a = new DataView(reference.buffer, reference.byteOffset, reference.byteLength);
  const b = new DataView(candidate.buffer, candidate.byteOffset, candidate.byteLength);
  let maxError = 0,
    aboveTolerance = 0,
    nonFinite = 0,
    referenceOnset = -1,
    candidateOnset = -1;
  for (let i = 0; i < a.byteLength / 4; i++) {
    const x = a.getFloat32(i * 4, true),
      y = b.getFloat32(i * 4, true);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      nonFinite++;
      continue;
    }
    if (referenceOnset < 0 && Math.abs(x) > 1e-7) referenceOnset = i;
    if (candidateOnset < 0 && Math.abs(y) > 1e-7) candidateOnset = i;
    const error = Math.abs(x - y);
    maxError = Math.max(error, maxError);
    if (error > TOLERANCE) aboveTolerance++;
  }
  return {
    pass: !aboveTolerance && !nonFinite && referenceOnset >= 0 && referenceOnset === candidateOnset,
    maxError,
    aboveTolerance,
    nonFinite,
    referenceOnset,
    candidateOnset,
    comparedSamples: reference.byteLength / 4,
    ignoredPrefixSamples: 0,
    tolerance: TOLERANCE,
  };
}
