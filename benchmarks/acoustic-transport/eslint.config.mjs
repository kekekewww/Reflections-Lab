import base from "../../eslint.config.mjs";

// Extend the repository's pinned parser and rules to this owned benchmark scope.
// No package installation or shared configuration change is needed.
const typeScript = base.find((entry) => entry.plugins?.["@typescript-eslint"]);
const javaScript = base.find((entry) => entry.rules?.["constructor-super"]);
if (!typeScript || !javaScript) throw new Error("COMPONENT_LINT_BASE_REQUIRED");
export default [
  ...base,
  { ...javaScript, files: ["benchmarks/acoustic-transport/**/*.mjs"] },
  { ...typeScript, files: ["benchmarks/acoustic-transport/**/*.ts"] },
];
