import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  sceneDomainErrors,
  materialDomainErrors,
  acousticFrameDomainErrors,
} from "./domain-checks.mjs";

export function loadValidators() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const discover = (relative = "") =>
    readdirSync(`schemas/${relative}`, { withFileTypes: true }).flatMap((entry) => {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      return entry.isDirectory()
        ? discover(file)
        : entry.isFile() && file.endsWith(".schema.json")
          ? [file]
          : [];
    });
  const files = discover().sort();
  for (const file of files) ajv.addSchema(JSON.parse(readFileSync(`schemas/${file}`, "utf8")));
  const validators = new Map();
  for (const file of files)
    validators.set(file, ajv.getSchema(`https://reflection-lab.local/schemas/${file}`));
  return validators;
}
export function validateRepositoryExamples(validators) {
  const domains = {
    scene: sceneDomainErrors,
    material: materialDomainErrors,
    "acoustic-frame": acousticFrameDomainErrors,
  };
  const reports = [];
  for (const [name, domain] of Object.entries(domains)) {
    const value = JSON.parse(readFileSync(`schemas/examples/${name}.json`, "utf8"));
    const validate = validators.get(`${name}.schema.json`);
    if (!validate(value)) throw new Error(`${name}: ${JSON.stringify(validate.errors)}`);
    const errors = domain(value);
    if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
    reports.push(name);
  }
  return reports;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const validators = loadValidators();
    const reports = validateRepositoryExamples(validators);
    console.log(
      `PASS AJV Draft2020-12: compiled ${validators.size} schemas; ${reports.length} repository examples passed schema and test-only domain checks. Run npm test for positive/negative contract fixtures.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
