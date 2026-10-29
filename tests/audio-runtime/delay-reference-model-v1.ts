/** Independent, predeclared numerical hypothesis. This imports no product DSP code. */
export const DELAY_REFERENCE_VERSION_V1 = "native-delay-reference-v1";
export const DELAY_REFERENCE_RATE_V1 = 48000;
export const DELAY_REFERENCE_FRAMES_V1 = 12000;
export const DELAY_REFERENCE_SOURCE_INDEX_V1 = 2880; // 0.05s emission + impulse buffer index480.
export const DELAY_REFERENCE_SAMPLE_LIMIT_V1 = 1e-7; // Diagnostic model agreement, never V1 acceptance.

export interface DelayReferencePathV1 {
  delaySeconds: number | null;
  gain: number;
  convolver: boolean;
}
export interface DelayReferenceCaseV1 {
  id: string;
  paths: readonly DelayReferencePathV1[];
}
const delays = [
  ["zero", null],
  ["delay-025", 0.025],
  ["delay-075", 0.075],
  ["delay-125", 0.125],
] as const;
export const DELAY_REFERENCE_CASES_V1: readonly DelayReferenceCaseV1[] = Object.freeze([
  ...delays.flatMap(([suffix, delaySeconds]) =>
    [false, true].map((convolver) => ({
      id: `${convolver ? "convolver-unit" : "gain-only"}-${suffix}`,
      paths: [{ delaySeconds, gain: 0.25, convolver }],
    })),
  ),
  {
    id: "parallel-original-paths",
    paths: [
      { delaySeconds: 0.025, gain: 0.5, convolver: true },
      { delaySeconds: 0.075, gain: 0.25, convolver: true },
    ],
  },
]);

/** Float32 delay-frames + two-sample linear interpolation; identity convolution is unchanged. */
export function predictDelayReferenceV1(spec: DelayReferenceCaseV1) {
  const f = Math.fround;
  const center = f(Math.SQRT1_2);
  const pcm = [
    new Float32Array(DELAY_REFERENCE_FRAMES_V1),
    new Float32Array(DELAY_REFERENCE_FRAMES_V1),
  ];
  const paths = spec.paths.map((path) => {
    const effectiveDelaySeconds = path.delaySeconds === null ? 0 : f(path.delaySeconds);
    const delayFrames = f(effectiveDelaySeconds * DELAY_REFERENCE_RATE_V1);
    const integerFrames = Math.floor(delayFrames);
    const fractionalFrames = delayFrames - integerFrames;
    const firstIndex = DELAY_REFERENCE_SOURCE_INDEX_V1 + integerFrames;
    const main = f(f(path.gain * f(1 - fractionalFrames)) * center);
    const adjacent = f(f(path.gain * fractionalFrames) * center);
    for (const channel of pcm) {
      channel[firstIndex] = f((channel[firstIndex] ?? 0) + main);
      if (adjacent !== 0) channel[firstIndex + 1] = f((channel[firstIndex + 1] ?? 0) + adjacent);
    }
    return { ...path, effectiveDelaySeconds, delayFrames, integerFrames, fractionalFrames };
  });
  let energy = 0;
  for (const channel of pcm) for (const value of channel) energy += value * value;
  return {
    model: "Float32-delay-frames-linear-interpolation-v1",
    status: "HYPOTHESIS_NOT_NATIVE_OBSERVATION",
    centerChannelCoefficient: center,
    idealEnergy: spec.paths.reduce((sum, path) => sum + path.gain ** 2, 0),
    energy,
    paths,
    sparsePcm: pcm.map((channel) =>
      Array.from(channel).flatMap((value, index) => (value === 0 ? [] : [{ index, value }])),
    ),
  };
}
