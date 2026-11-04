import test from "node:test";
import assert from "node:assert/strict";
import { noticePackages, siteHeaders } from "../../scripts/build-site.mjs";

function policy() {
  const line = siteHeaders()
    .split("\n")
    .find((row) => row.includes("Content-Security-Policy"));
  assert.ok(line, "the site must send a content security policy");
  return Object.fromEntries(
    line
      .replace(/^\s*Content-Security-Policy:\s*/, "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      }),
  );
}

test("the page can only send data to itself and to Meta's API", () => {
  assert.deepEqual(policy()["connect-src"], ["'self'", "https://api.meta.ai"]);
});

test("the page can only run its own scripts", () => {
  const rules = policy();
  // Ajv compiles its schemas with new Function and Rapier needs WebAssembly. Nothing else is allowed.
  assert.deepEqual(rules["script-src"], ["'self'", "'unsafe-eval'"]);
  assert.deepEqual(rules["worker-src"], ["'self'"]);
  assert.deepEqual(rules["default-src"], ["'self'"]);
  assert.deepEqual(rules["object-src"], ["'none'"]);
  assert.deepEqual(rules["base-uri"], ["'none'"]);
  assert.deepEqual(rules["form-action"], ["'none'"]);
  assert.deepEqual(rules["frame-ancestors"], ["'none'"]);
});

test("the page sends no referrer and isn't sniffed", () => {
  assert.match(siteHeaders(), /Referrer-Policy: no-referrer/);
  assert.match(siteHeaders(), /X-Content-Type-Options: nosniff/);
});

test("licence notices come from the packages in the source maps, including nested ones", () => {
  const sources = [
    "../../node_modules/react/index.js",
    "../../node_modules/@react-three/fiber/dist/x.js",
    "../../node_modules/a/node_modules/b/index.js",
    "../../src/app/runtime.ts",
    "\0vite/preload",
  ];
  assert.deepEqual(
    noticePackages(sources).map((entry) => [entry.name, entry.directory.split("\\").join("/")]),
    [
      ["@react-three/fiber", "node_modules/@react-three/fiber"],
      ["b", "node_modules/a/node_modules/b"],
      ["react", "node_modules/react"],
    ],
  );
});
