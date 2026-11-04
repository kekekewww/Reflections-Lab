import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import ts from "typescript";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const parse = (source, typescript = false) =>
  ts.createSourceFile(
    typescript ? "legacy.spec.ts" : "legacy.mjs",
    source,
    ts.ScriptTarget.ESNext,
    true,
    typescript ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
const rules = {
  "interaction-audit.mjs": { output: ["out"], cache: ["cache"] },
  "interaction-completion.mjs": { output: ["out"], cache: ["cache"] },
  "interaction-priority.mjs": {
    output: ["out"],
    cache: ["cache"],
    publicActionIdentity: "held-gentle-place",
  },
  "scene-inspector-run.mjs": { output: ["out"] },
  "scene-environment-final.mjs": { output: ["out"], identityObject: "receipt" },
  "scene-curved-final.mjs": { output: ["out"] },
  "behavior-run.mjs": { output: ["out"], root: ["root"] },
  "behavior-assets-run.mjs": { output: ["out"], root: ["root"] },
  "monitor-audit.mjs": { output: ["out"] },
  "monitor-retest.mjs": { output: ["out"] },
  "pipeline-agent-audit.spec.ts": { output: ["evidenceDir"] },
  "pipeline-dock-paths-comparison.spec.ts": { output: ["evidenceDir"] },
  "pipeline-events-audit.spec.ts": { output: ["evidenceDir"], cache: ["cacheDir"] },
  "pipeline-motion-audit.spec.ts": { output: ["rootEvidenceDir", "evidenceDir"] },
  "pipeline-zones-audit.spec.ts": { output: [] },
  "pipeline-zones-helpers.ts": { output: ["evidenceDir"], cache: ["cacheDir"] },
  "pipeline-render-performance-render.spec.ts": { output: ["evidenceRoot"], cache: ["cacheRoot"] },
  "pipeline-render-performance-tail-validation.spec.ts": { output: ["evidence"], cache: ["cache"] },
  "pipeline-render-performance-diagnostics.spec.ts": {
    output: ["evidenceDir"],
    identityObject: "receipt",
  },
  "pipeline-render-performance-combined.spec.ts": {
    output: ["evidence"],
    cache: ["cache"],
    fixtureRoot: "reportRoot",
  },
  "pipeline-help-sweep-audit.spec.ts": { output: ["evidence"], cache: ["cache"] },
};
export const combinedFixturePath =
  "docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render/final-combined-contract.json";
function assertionTexts(file) {
  const values = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(file);
      if (
        expression.startsWith("assert.") ||
        expression === "expect" ||
        /^expect[.(]/.test(expression)
      )
        values.push(node.getText(file));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return values;
}
function adapt(source, settings, { typescript, requireScript }) {
  const {
    outputDirectory,
    cacheDirectory,
    projectRoot,
    executablePath,
    sourceCommit,
    entryName,
    guardModuleUrl,
    testModuleUrl,
    legacySourcePath,
    scopeAmendment,
    publicActionIdentitySourcePins,
  } = settings;
  const filename = legacySourcePath ? basename(legacySourcePath) : null;
  const policy = filename
    ? rules[filename]
    : { output: ["out"], cache: ["cache"], root: ["root"], identityObject: "receipt" };
  assert.ok(policy, "Legacy file requires an explicit per-file metadata policy");
  const file = parse(source, typescript),
    edits = [];
  assert.equal(
    file.parseDiagnostics.length,
    0,
    "Legacy source must parse before metadata adaptation",
  );
  let outputDeclarations = 0,
    launches = 0;
  const requiredFixturePaths = [];
  const directory = (path) => JSON.stringify(path.endsWith("/") ? path : path + "/");
  const edit = (node, replacement, kind) =>
    edits.push({
      start: node.getStart(file),
      end: node.getEnd(),
      before: node.getText(file),
      after: replacement,
      kind,
    });
  for (const statement of file.statements) {
    if (requireScript && ts.isImportDeclaration(statement))
      assert.ok(
        !statement.moduleSpecifier.text.startsWith("."),
        "Relative-import legacy script requires an explicit owned port",
      );
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const name = declaration.name.text;
      if (policy.output.includes(name)) {
        edit(declaration.initializer, directory(outputDirectory), "output-directory");
        outputDeclarations++;
      }
      if (policy.cache?.includes(name))
        edit(declaration.initializer, directory(cacheDirectory), "cache-directory");
      if (policy.root?.includes(name))
        edit(declaration.initializer, JSON.stringify(projectRoot), "project-root");
      if (policy.fixtureRoot === name) {
        edit(
          declaration.initializer,
          directory(resolve(projectRoot, combinedFixturePath, "..")),
          "immutable-fixture-root",
        );
        requiredFixturePaths.push(combinedFixturePath);
      }
    }
  }
  const visit = (node) => {
    if (
      policy.publicActionIdentity === "held-gentle-place" &&
      ts.isCallExpression(node) &&
      node.expression.getText(file) === "button" &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "Place" &&
      ts.isPropertyAccessExpression(node.parent) &&
      node.parent.name.text === "isDisabled"
    ) {
      assert.ok(
        Array.isArray(publicActionIdentitySourcePins) &&
          ["src/ui/Viewport.tsx", "src/ui/locales/viewport.ts"].every((path) =>
            publicActionIdentitySourcePins.some(
              (pin) => pin.path === path && /^[a-f0-9]{64}$/.test(pin.sha256),
            ),
          ),
        "Held action identity requires current public action source pins",
      );
      edit(
        node.arguments[0],
        JSON.stringify("Gentle place"),
        "approved-accessible-action-identity",
      );
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "locator" &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "canvas"
    ) {
      assert.ok(
        scopeAmendment &&
          typeof scopeAmendment.path === "string" &&
          /^[a-f0-9]{64}$/.test(scopeAmendment.sha256),
        "3D selector port requires explicit scope authority",
      );
      edit(
        node.arguments[0],
        JSON.stringify(".viewport-canvas-wrap canvas"),
        "approved-3d-selector-identity",
      );
    }
    if (
      !requireScript &&
      testModuleUrl &&
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier.text === "@playwright/test" &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some((element) => element.name.text === "test")
    )
      edit(
        node.moduleSpecifier,
        JSON.stringify(testModuleUrl),
        "browser-provenance-fixture-import",
      );
    if (ts.isCallExpression(node) && node.expression.getText(file) === "chromium.launch") {
      const options = node.arguments[0];
      assert.ok(
        options && ts.isObjectLiteralExpression(options),
        "Legacy launch requires a literal option object",
      );
      assert.ok(
        !options.properties.some((property) => property.name?.getText(file) === "executablePath"),
        "Do not overwrite an existing browser pin",
      );
      edits.push({
        start: options.getStart(file) + 1,
        end: options.getStart(file) + 1,
        before: "",
        after: ` executablePath: ${JSON.stringify(executablePath)}, `,
        kind: "browser-executable",
      });
      if (guardModuleUrl) {
        let binding = node.parent;
        while (
          binding &&
          !ts.isVariableDeclaration(binding) &&
          !ts.isBinaryExpression(binding) &&
          !ts.isStatement(binding)
        )
          binding = binding.parent;
        const name =
          binding && ts.isVariableDeclaration(binding) && ts.isIdentifier(binding.name)
            ? binding.name.text
            : binding && ts.isBinaryExpression(binding) && ts.isIdentifier(binding.left)
              ? binding.left.text
              : null;
        assert.ok(name, "Browser launch must bind a known public test client");
        let statement = node;
        while (statement && !ts.isStatement(statement)) statement = statement.parent;
        assert.ok(statement, "Browser launch statement is required");
        edits.push({
          start: statement.end,
          end: statement.end,
          before: "",
          after: `\nawait (await import(${JSON.stringify(guardModuleUrl)})).guardBrowser(${name}, { outputDirectory: ${JSON.stringify(outputDirectory)} });\n`,
          kind: "browser-network-provenance-guard",
        });
      }
      launches++;
    }
    if (
      policy.identityObject &&
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.initializer)
    ) {
      const owner = ts.findAncestor(node, (parent) => ts.isVariableDeclaration(parent));
      const name = node.name.getText(file).replace(/^["']|["']$/g, "");
      if (owner?.name.getText(file) === policy.identityObject) {
        if (
          name === "declaredSource" &&
          /^[a-f0-9]{7,40} \/ index-[A-Za-z0-9_-]+ \(actual network bytes separately pinned\)$/.test(
            node.initializer.text,
          )
        )
          edit(
            node.initializer,
            JSON.stringify(
              `${sourceCommit} / ${entryName} (actual network bytes separately pinned)`,
            ),
            "source-identity-metadata",
          );
        if (name === "sourceCommit" && /^[a-f0-9]{40}$/.test(node.initializer.text))
          edit(node.initializer, JSON.stringify(sourceCommit), "source-identity-metadata");
        if (name === "declaredEntry" && /^index-.*\.js$/.test(node.initializer.text))
          edit(node.initializer, JSON.stringify(entryName), "entry-identity-metadata");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (policy.publicActionIdentity === "held-gentle-place")
    assert.equal(
      edits.filter((edit) => edit.kind === "approved-accessible-action-identity").length,
      1,
      "Known held action selector must have one exact identity port",
    );
  if (requireScript) {
    assert.equal(
      outputDeclarations,
      1,
      "Legacy script must have exactly one top-level out declaration",
    );
    assert.ok(launches > 0, "Legacy script must have a known direct browser launch");
  }
  const ascending = edits.sort((a, b) => a.start - b.start);
  for (let index = 1; index < ascending.length; index++)
    assert.ok(
      ascending[index - 1].end <= ascending[index].start,
      "Metadata edits must not overlap",
    );
  let adapted = "",
    cursor = 0;
  const preservedSpans = [];
  for (const change of ascending) {
    const untouched = source.slice(cursor, change.start),
      adaptedStart = adapted.length;
    adapted += untouched;
    if (untouched.length)
      preservedSpans.push({
        originalStart: cursor,
        originalEnd: change.start,
        adaptedStart,
        adaptedEnd: adapted.length,
        sha256: sha(untouched),
      });
    change.adaptedStart = adapted.length;
    adapted += change.after;
    change.adaptedEnd = adapted.length;
    cursor = change.end;
  }
  const finalStart = adapted.length,
    tail = source.slice(cursor);
  adapted += tail;
  if (tail.length)
    preservedSpans.push({
      originalStart: cursor,
      originalEnd: source.length,
      adaptedStart: finalStart,
      adaptedEnd: adapted.length,
      sha256: sha(tail),
    });
  for (const span of preservedSpans)
    assert.equal(
      source.slice(span.originalStart, span.originalEnd),
      adapted.slice(span.adaptedStart, span.adaptedEnd),
      "All characters outside recorded metadata and approved selector edits must remain identical",
    );
  const parsed = parse(adapted, typescript);
  assert.equal(
    parsed.parseDiagnostics.length,
    0,
    "Adapted metadata must remain valid JavaScript/TypeScript",
  );
  const assertions = assertionTexts(file);
  const approvedSelectorChanges = ascending.filter((change) =>
    ["approved-3d-selector-identity", "approved-accessible-action-identity"].includes(change.kind),
  );
  let selectorOnly = source;
  for (const change of [...approvedSelectorChanges].reverse())
    selectorOnly =
      selectorOnly.slice(0, change.start) + change.after + selectorOnly.slice(change.end);
  const expectedAssertions = assertionTexts(parse(selectorOnly, typescript));
  const adaptedAssertions = assertionTexts(parsed);
  assert.deepEqual(
    adaptedAssertions,
    expectedAssertions,
    "Every assertion method, numeric bound and behavior value must remain unchanged outside approved 3D selectors",
  );
  return {
    source: adapted,
    proof: {
      originalSha256: sha(source),
      adaptedSha256: sha(adapted),
      legacySourcePath: legacySourcePath ?? "unit-fixture",
      metadataPolicy: policy,
      relativeImports: file.statements
        .filter(
          (statement) =>
            ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.startsWith("."),
        )
        .map((statement) => statement.moduleSpecifier.text),
      offsetUnit: "UTF16 code units",
      requiredFixturePaths,
      preservedSpans,
      allNonMetadataCharactersPreserved: approvedSelectorChanges.length === 0,
      allNonPortCharactersPreserved: true,
      originalAssertionCount: assertions.length,
      assertionsSha256: sha(JSON.stringify(assertions)),
      assertionTextPreserved: JSON.stringify(assertions) === JSON.stringify(adaptedAssertions),
      behaviorAssertionsExceptApprovedSelectorsPreserved: true,
      adaptedAssertionsSha256: sha(JSON.stringify(adaptedAssertions)),
      approvedSelectorChanges,
      scopeAmendment: scopeAmendment ?? null,
      publicActionIdentitySourcePins: publicActionIdentitySourcePins ?? [],
      edits: ascending,
      scope:
        "Recorded output/cache/browser/source identity metadata and explicitly authorized 3D canvas and existing held-action accessible selector identity ports only. Assertion methods, numeric bounds and behavior values remain exact; historical files are untouched.",
    },
  };
}
export function adaptLegacyScript(source, settings) {
  return adapt(source, settings, { typescript: false, requireScript: true });
}
export function adaptLegacyTestSource(source, settings) {
  return adapt(source, settings, { typescript: true, requireScript: false });
}

export function selectLegacyCases(source, excludedCaseIds, scopeAmendment) {
  assert.ok(
    scopeAmendment && /^[a-f0-9]{64}$/.test(scopeAmendment.sha256),
    "Case removal requires explicit scope authority",
  );
  const file = parse(source),
    originalCaseIds = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "check") {
      assert.ok(
        ts.isStringLiteral(node.arguments[0]),
        "Current filter requires literal legacy check IDs",
      );
      originalCaseIds.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(
    originalCaseIds.length > 0 && new Set(originalCaseIds).size === originalCaseIds.length,
    "Known unique legacy cases required",
  );
  assert.ok(
    excludedCaseIds.length > 0 && excludedCaseIds.every((id) => originalCaseIds.includes(id)),
    "Unknown excluded legacy case",
  );
  const selectedCaseIds = originalCaseIds.filter((id) => !excludedCaseIds.includes(id));
  assert.ok(selectedCaseIds.length > 0, "Removal cannot suppress the entire legacy lane");
  return {
    originalSourceSha256: sha(source),
    scopeAmendment,
    originalCaseIds,
    selectedCaseIds,
    excluded: excludedCaseIds.map((id) => ({ id, status: "SUPERSEDED_REMOVED" })),
    method:
      "Existing public selectedCases CLI filter only; every historical source character and assertion remains stored unchanged.",
  };
}
