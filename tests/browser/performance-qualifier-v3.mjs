// Preparation contract only: --plan prints the NEXT proposed bounded scenario. No browser is launched.
import { pathToFileURL } from "node:url";
import path from "node:path";
export const qualificationPlan = Object.freeze({
  status: "NOT_RUN_NOT_AUTHORIZED_BY_THIS_PLAN",
  formal600Run: false,
  semanticPilot: {
    scenario:
      "24 actual callbacks on exact-revision owned document; pretrace/twins/nested/cancel/custom-startTime",
    operationWallMs: 45000,
    cleanupWallMs: 10000,
    callbacks: 128,
    compressedBytes: 8388608,
    decompressedBytes: 33554432,
    events: 200000,
    paidCalls: 0,
    extension:
      "Separate mark-before-clear/clear/exact trace persistence comparison. Retained-mark collector remains default until this actual trace is independently reviewed.",
  },
  shortProduct: {
    seconds: 20,
    phase: "all",
    physicsIterations: 3000,
    acousticIterations: 600,
    warmupMs: 10000,
    nativeProducerRevision: "d0c02bfad08ec92a6ffcf989e53cd995e6381a4c",
    status: "AFTER_PURE_AND_SEMANTIC_PILOT_RELEASE_ONLY",
    criterionActual600Seconds: false,
  },
  negativeScope: [
    "future raw/native timestamp diagnostic",
    "twins and exact group counts",
    "inclusive fire/callTime edges",
    "50000us coverage edge and edge+1",
    "wrong/malformed task plus valid task",
    "trace/mark/proof loss",
    "caps exact boundary and cap+1",
    "unknown state and post-close sample",
    "registration/cancel/handle wrap",
    "Float64 argument/handle/cancel/invoke-once/restoration through inherited observer",
  ],
});
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.slice(2).join(" ") !== "--plan")
    throw new Error("V3_QUALIFIER_EXECUTION_NOT_IMPLEMENTED_OR_AUTHORIZED");
  process.stdout.write(JSON.stringify(qualificationPlan, null, 2) + "\n");
}
