import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const workspace = process.argv[2];
assert.ok(workspace, "Workspace argument required");
const candidate = await import(pathToFileURL(path.join(workspace, "answer.mjs")));
assert.equal(candidate.answer, 42, "Independent prewritten reference answer must equal42");
console.log("PASS independent reference answer=42");
