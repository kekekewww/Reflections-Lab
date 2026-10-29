import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const outputRoot = "docs/en";
const ignored = new Set([
  ".git",
  ".cache",
  "node_modules",
  "test-results",
  "dist",
  "coverage",
  "playwright-report",
  ".playwright-mcp",
]);
const sha = (data) => createHash("sha256").update(data).digest("hex");
const slash = (value) => value.split(path.sep).join("/");
const preparedSourcePins = [
  [
    "artifacts/v1/audio-prepared-static-v2-preflight-20261027153307199/prepared-static-v2",
    "build-spec.json",
    "924e97b927ff9b03c65e9a93dcc945e328f2e4afff1624c4ec63334e157fef23",
  ],
  [
    "artifacts/v1/audio-prepared-static-v2-preflight-20261027153418936/prepared-static-v2",
    "manifest.json",
    "6e05d21f0aa53a801f434cf12cadb1eea7093abaf6ee1d785dad4bc50142c868",
  ],
  [
    "artifacts/v1/audio-prefix-native25-preflight-20261027172830/prepared-static-v2",
    "manifest.json",
    "585b2e7d93ad35905aa735e00c27212b4eef1017d926873169e1c2dd56a1eeb2",
  ],
].map(([directory, receipt, receiptHash]) => ({
  source: `${directory}/sources/tests/audio-runtime/CROSS_ENGINE.md`,
  canonical: "tests/audio-runtime/CROSS_ENGINE.md",
  sourceHash: "442e12e66bd5b2388af72f3d8d0447a6ba0eafa3c0bf6c7748ac61f785f5b847",
  evidence: `${directory}/${receipt}`,
  evidenceHash: receiptHash,
}));
export function listMarkdown(root, directory = "") {
  if (directory === "" && fs.existsSync(path.join(root, ".git"))) {
    const listed = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        timeout: 10000,
        windowsHide: true,
      },
    );
    return [...new Set(listed.split("\0").filter(Boolean))]
      .filter(
        (file) => /\.md$/i.test(file) && file !== outputRoot && !file.startsWith(`${outputRoot}/`),
      )
      .filter((file) => {
        if (path.isAbsolute(file) || file.split("/").includes(".."))
          throw Error("Git returned an outside-workspace path");
        const absolute = path.join(root, file);
        if (!fs.existsSync(absolute)) return false;
        const stat = fs.lstatSync(absolute);
        return stat.isFile() && !stat.isSymbolicLink();
      })
      .sort();
  }
  return fs
    .readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap((entry) => {
      if (ignored.has(entry.name) || entry.isSymbolicLink()) return [];
      const file = path.posix.join(directory, entry.name);
      if (file === outputRoot || file.startsWith(`${outputRoot}/`)) return [];
      return entry.isDirectory()
        ? listMarkdown(root, file)
        : entry.isFile() && /\.md$/i.test(file)
          ? [file]
          : [];
    })
    .sort();
}
export function englishTarget(source) {
  if (source.startsWith("docs/")) return `${outputRoot}/${source.slice(5)}`;
  if (source.startsWith(".agents/")) return `${outputRoot}/agent-skills/${source.slice(8)}`;
  if (source.startsWith(".claude/")) return `${outputRoot}/compatibility/${source.slice(8)}`;
  return `${outputRoot}/${source}`;
}
function recordedPin(value, expectedPath, expectedHash, depth = 0) {
  if (depth > 30 || !value || typeof value !== "object") return false;
  if (!Array.isArray(value)) {
    const candidate = value.path ?? value.source ?? value.originalPath;
    const digest = value.sha256 ?? value.hash;
    if (
      typeof candidate === "string" &&
      typeof digest === "string" &&
      slash(candidate).replace(/\\/g, "/") === expectedPath &&
      digest.toLowerCase() === expectedHash
    )
      return true;
  }
  return Object.values(value).some((child) =>
    recordedPin(child, expectedPath, expectedHash, depth + 1),
  );
}
function readEvidenceJSON(root, file) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink()) return null;
  const bytes = fs.readFileSync(absolute);
  if (bytes.byteLength > 8 * 1024 * 1024) return null;
  try {
    return { path: file, sha256: sha(bytes), value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    return null;
  }
}
// Immutable per-file evidence pins for this particular Playwright capture.
const pinnedBrowserContexts = new Map(
  Object.entries({
    "artifacts/v1/r17-vacuum-browser-red-20261029/proofs/linked-workflow-v2-real-un-56281-rics-with-its-actual-reason/error-context.md":
      {
        sourceHash: "1d3913f2f6936b79e1454d9a447168fda0eca56bebfca584ec51337791040fd6",
        receipt: {
          path: "artifacts/v1/r17-vacuum-browser-red-20261029/run-results.json",
          sha256: "39c3eb58998927a802c4bc6db25f9c725e6bc1ab8bcb684bebf22ef98c95d3d5",
        },
      },
    "artifacts/v1/r13-ui-2026-10-28T085649588Z-f90bb40a/cases/ui-refined-v2-completed-re-cfb13--raw-RecordingArtifact-JSON/error-context.md":
      {
        sourceHash: "855b20f98d74c251de189806a0abaa040e9407d7773a285ca01c84966abead67",
        receipt: {
          path: "artifacts/v1/r13-ui-2026-10-28T085649588Z-f90bb40a/playwright-results.json",
          sha256: "a5034f2ee815148be08e7cd4f486832d266e3a89b0617c42171745c24e78c4e8",
        },
      },
    "artifacts/v1/r13-ui-2026-10-28T085649588Z-f90bb40a/cases/ui-refined-v2-project-JSON-2db83--draft-until-explicit-Apply/error-context.md":
      {
        sourceHash: "38532a24c06b32424661c03380be0cfa34789f876a0e8cafbc47d839f9c481a7",
        receipt: {
          path: "artifacts/v1/r13-ui-2026-10-28T085649588Z-f90bb40a/playwright-results.json",
          sha256: "a5034f2ee815148be08e7cd4f486832d266e3a89b0617c42171745c24e78c4e8",
        },
      },
    "artifacts/v1/r13-ui-2026-10-28T085649588Z-f90bb40a/cases/ui-refined-v2-reset-seals--88c67--replay-remains-unavailable/error-context.md":
      {
        sourceHash: "1f026486b151ffdb72c75f6cfa3e41beb27f78b7b5159b776a77d39e3eaaee1d",
        receipt: {
          path: "artifacts/v1/r13-ui-2026-10-28T085649588Z-f90bb40a/playwright-results.json",
          sha256: "a5034f2ee815148be08e7cd4f486832d266e3a89b0617c42171745c24e78c4e8",
        },
      },
    "artifacts/v1/r13-product-2026-10-28T090742166Z-935fa33e/cases/product-e2e-refined-v2-a-s-2e0eb-without-activating-hardware/error-context.md":
      {
        sourceHash: "b70beca090a399cc7ea101be6c303ee2c415a0cdef89966313360812fed36e91",
        receipt: {
          path: "artifacts/v1/r13-product-2026-10-28T090742166Z-935fa33e/playwright-results.json",
          sha256: "346bd404537b82aeeea77449a83e54c9f1490706df4ce15d8148361c8b58b858",
        },
      },
  }),
);
function recordedAttachment(value, suffix, depth = 0) {
  if (depth > 30 || !value || typeof value !== "object") return false;
  if (
    value.name === "error-context" &&
    value.contentType === "text/markdown" &&
    typeof value.path === "string" &&
    value.path.replace(/\\/g, "/").endsWith(suffix)
  )
    return true;
  return Object.values(value).some((child) => recordedAttachment(child, suffix, depth + 1));
}
function terminalGeneratedSource(text) {
  const chunks = segments(text);
  const index = chunks.findLastIndex(
    (chunk) => !chunk.code && /^ {0,3}# Test source[ \t]*(?:\r?\n|$)/m.test(chunk.text),
  );
  if (index < 0) return false;
  const marker = chunks[index].text.match(/^ {0,3}# Test source[ \t]*(?:\r?\n|$)/m);
  const tail = [
    { code: false, text: chunks[index].text.slice(marker.index + marker[0].length) },
    ...chunks.slice(index + 1),
  ];
  const blocks = tail.filter((chunk) => chunk.code);
  if (blocks.length !== 1 || tail.some((chunk) => !chunk.code && chunk.text.trim())) return false;
  const lines = blocks[0].text.trimEnd().split(/\r?\n/);
  const fence = lines[0].match(/^ {0,3}(`{3,}|~{3,})/);
  const close = lines.at(-1).match(/^ {0,3}(`+|~+)[ \t]*$/);
  return Boolean(
    fence && close && close[1][0] === fence[1][0] && close[1].length >= fence[1].length,
  );
}
export function classifyArtifactMarkdown(root, source, bytes) {
  if (!source.startsWith("artifacts/")) return null;
  // These exact historical copies retain receipt provenance even after the canonical
  // document changes. A broken registered pin cannot fall back to byte equality.
  const preparedPin = preparedSourcePins.find((pin) => pin.source === source);
  if (preparedPin) {
    const evidence = readEvidenceJSON(root, preparedPin.evidence);
    if (
      sha(bytes) === preparedPin.sourceHash &&
      evidence?.sha256 === preparedPin.evidenceHash &&
      Object.hasOwn(evidence.value.originalSources ?? {}, preparedPin.canonical) &&
      evidence.value.originalSources[preparedPin.canonical] === preparedPin.sourceHash
    )
      return {
        classification: "shared_raw_source_snapshot",
        reason:
          "Exact registered captured Markdown bytes match their originalSources receipt pin; raw source evidence does not imply that the build or native tests passed.",
        canonical_source: preparedPin.canonical,
        confirmation: "REGISTERED_PREPARED_SOURCE_MAP_PIN_MATCH",
        evidence: { path: evidence.path, sha256: evidence.sha256 },
      };
    return {
      classification: "project_authored_artifact_narrative",
      reason:
        "A registered immutable source-copy pin is invalid; it cannot be excluded as raw evidence.",
      classification_error: {
        code: "IMMUTABLE_SOURCE_SNAPSHOT_PIN_MISMATCH",
        expected_source_sha256: preparedPin.sourceHash,
        actual_source_sha256: sha(bytes),
        evidence: preparedPin.evidence,
        expected_evidence_sha256: preparedPin.evidenceHash,
        actual_evidence_sha256: evidence?.sha256 ?? null,
      },
    };
  }
  const digest = sha(bytes),
    copy = source.match(
      /^(artifacts\/.*?)\/(source-before|source-after|sources|tested-bundle)\/(.+\.md)$/i,
    );
  if (copy) {
    const canonical = path.posix.normalize(copy[3]);
    if (!canonical.startsWith("../") && !path.posix.isAbsolute(canonical)) {
      const actual = path.join(root, canonical);
      if (
        fs.existsSync(actual) &&
        fs.lstatSync(actual).isFile() &&
        !fs.lstatSync(actual).isSymbolicLink() &&
        sha(fs.readFileSync(actual)) === digest
      )
        return {
          classification: "shared_raw_source_snapshot",
          reason: "Byte-identical captured source copy; not a newly authored narrative.",
          canonical_source: canonical,
          confirmation: "CURRENT_CANONICAL_BYTES_MATCH",
        };
      for (const name of [
        "before.json",
        "after.json",
        "source-before.json",
        "source-after.json",
        "verification.json",
        "build.json",
        "proof-receipt.json",
      ]) {
        const evidence = readEvidenceJSON(root, `${copy[1]}/${name}`);
        if (evidence && recordedPin(evidence.value, canonical, digest))
          return {
            classification: "shared_raw_source_snapshot",
            reason:
              "Captured source bytes match the pinned source path/hash in the capture evidence; current canonical bytes may differ.",
            canonical_source: canonical,
            confirmation: "PINNED_CAPTURE_HASH_MATCH",
            evidence: { path: evidence.path, sha256: evidence.sha256 },
          };
      }
    }
  }
  const pinnedContext = pinnedBrowserContexts.get(source);
  if (pinnedContext) {
    const pinnedContextHash = pinnedContext.sourceHash;
    const pinnedBrowserReceipt = pinnedContext.receipt;
    const evidence = readEvidenceJSON(root, pinnedBrowserReceipt.path);
    const text = bytes.toString("utf8");
    const sections = headings(text);
    const titles = sections.map((heading) => heading.title).join("|");
    const expected = [
      "Instructions|Test info|Error details|Test source",
      "Instructions|Test info|Error details|Page snapshot|Test source",
    ];
    if (
      sha(bytes) === pinnedContextHash &&
      evidence?.sha256 === pinnedBrowserReceipt.sha256 &&
      Array.isArray(evidence.value.suites) &&
      evidence.value.stats &&
      recordedAttachment(evidence.value, source) &&
      sections.every((heading) => heading.level === 1) &&
      expected.includes(titles) &&
      text.includes("Following Playwright test failed.") &&
      terminalGeneratedSource(text)
    )
      return {
        classification: "shared_raw_generated_browser_context",
        reason:
          "Exact registered generated Playwright failure context and its recorded attachment match immutable source and receipt pins; preserved as raw evidence, not an authored project report.",
        confirmation: "REGISTERED_GENERATED_CONTEXT_AND_RECEIPT_PIN_MATCH",
        evidence: { path: evidence.path, sha256: evidence.sha256 },
      };
    return {
      classification: "project_authored_artifact_narrative",
      reason:
        "A registered generated context or its receipt does not match its immutable pin; it cannot be excluded as raw evidence.",
      classification_error: {
        code: "IMMUTABLE_GENERATED_CONTEXT_PIN_MISMATCH",
        expected_source_sha256: pinnedContextHash,
        actual_source_sha256: sha(bytes),
        evidence: pinnedBrowserReceipt.path,
        expected_evidence_sha256: pinnedBrowserReceipt.sha256,
        actual_evidence_sha256: evidence?.sha256 ?? null,
      },
    };
  }
  const browser = source.match(/^(artifacts\/.*?)\/cases\/(.+\/error-context\.md)$/i);
  if (browser) {
    const text = bytes.toString("utf8"),
      sections = headings(text),
      expected = ["Instructions", "Test info", "Error details", "Page snapshot", "Test source"];
    const evidence = readEvidenceJSON(root, `${browser[1]}/results.json`);
    if (
      sections.every((heading) => heading.level === 1) &&
      sections.map((heading) => heading.title).join("|") === expected.join("|") &&
      terminalGeneratedSource(text) &&
      text.includes("Following Playwright test failed.") &&
      evidence &&
      Array.isArray(evidence.value.suites) &&
      evidence.value.stats &&
      recordedAttachment(evidence.value, `cases/${browser[2]}`)
    )
      return {
        classification: "shared_raw_generated_browser_context",
        reason:
          "Standard generated Playwright failure context, matched to a recorded error-context attachment; preserved as raw evidence, not an authored project report.",
        confirmation: "GENERATED_CONTEXT_AND_RECORDED_ATTACHMENT",
        evidence: { path: evidence.path, sha256: evidence.sha256 },
      };
  }
  return {
    classification: "project_authored_artifact_narrative",
    reason:
      "Artifact Markdown is included as project narrative unless a verified raw-copy/generated-context rule applies.",
  };
}
function selectedSourcePaths(root, sourcePaths) {
  if (!Array.isArray(sourcePaths) || !sourcePaths.length)
    throw new Error("Explicit sourcePaths must be a nonempty array");
  if (new Set(sourcePaths).size !== sourcePaths.length)
    throw new Error("Explicit sourcePaths must not contain duplicates");
  for (const source of sourcePaths) {
    if (
      typeof source !== "string" ||
      !/\.md$/i.test(source) ||
      source.includes("\\") ||
      path.isAbsolute(source) ||
      path.win32.isAbsolute(source) ||
      source.split("/").includes("..") ||
      path.posix.normalize(source) !== source ||
      source.startsWith(`${outputRoot}/`)
    )
      throw new Error("Explicit sourcePaths must be canonical workspace source Markdown paths");
    const stat = fs.lstatSync(path.join(root, source));
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("Explicit sourcePaths must identify regular source files");
  }
  return [...sourcePaths].sort();
}
export function inspectDocumentationSources(root, sourcePaths = null) {
  const excluded_shared_raw = [];
  const sources = (
    sourcePaths === null ? listMarkdown(root) : selectedSourcePaths(root, sourcePaths)
  ).flatMap((source) => {
    const bytes = fs.readFileSync(path.join(root, source));
    const classification = classifyArtifactMarkdown(root, source, bytes);
    if (classification && classification.classification !== "project_authored_artifact_narrative") {
      excluded_shared_raw.push({
        source,
        source_sha256: sha(bytes),
        source_bytes: bytes.byteLength,
        ...classification,
      });
      return [];
    }
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
    const han = [...text.matchAll(/\p{Script=Han}/gu)].length;
    const existingEnglish = source === "README.md" ? "README.en.md" : null;
    const alreadyEnglish = /\.en\.md$/i.test(source) || han === 0;
    return {
      source,
      source_sha256: sha(bytes),
      source_bytes: bytes.byteLength,
      han_characters: han,
      target: existingEnglish ?? (alreadyEnglish ? source : englishTarget(source)),
      kind: existingEnglish
        ? "existing_english_companion"
        : alreadyEnglish
          ? "original_english"
          : "translation_required",
      ...(classification
        ? {
            artifact_role: classification.classification,
            classification_reason: classification.reason,
            ...(classification.classification_error
              ? { classification_error: classification.classification_error }
              : {}),
          }
        : {}),
    };
  });
  return { sources, excluded_shared_raw };
}
export function inventory(root) {
  return inspectDocumentationSources(root).sources;
}
const markerRE = /^<!-- english-source: (\{[^\r\n]+\}) -->\r?\n/;
const rel = (from, to) => slash(path.relative(path.dirname(from), to));
function saveJSON(root, file, value) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + "\n");
}
export function parseTranslation(text) {
  const marker = text.match(markerRE);
  if (!marker) return null;
  try {
    return { metadata: JSON.parse(marker[1]), body: text.slice(marker[0].length) };
  } catch {
    return null;
  }
}
/** Code examples are deliberately excluded from navigation and prose checks. */
export function segments(text) {
  const result = [];
  let buffer = "",
    fence = null;
  for (const line of text.match(/[^\r\n]*(?:\r?\n|$)/g)?.filter(Boolean) ?? []) {
    const plain = line.replace(/\r?\n$/, "");
    if (!fence) {
      const open = plain.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (open) {
        if (buffer) result.push({ code: false, text: buffer });
        buffer = line;
        fence = open[1];
      } else buffer += line;
    } else {
      buffer += line;
      const close = plain.match(/^ {0,3}(`+|~+)\s*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
        result.push({ code: true, text: buffer });
        buffer = "";
        fence = null;
      }
    }
  }
  if (buffer) result.push({ code: Boolean(fence), text: buffer });
  return result;
}
function cleanGenerated(text) {
  return text
    .replace(/<!-- english-notice:start -->[\s\S]*?<!-- english-notice:end -->\r?\n(?:\r?\n)?/g, "")
    .replace(/<!-- english-original-anchor -->\s*<a id="[^"]*"><\/a>\r?\n?/g, "");
}
function noFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}
function headings(text) {
  return segments(noFrontmatter(text))
    .filter((s) => !s.code)
    .flatMap((s) =>
      [...s.text.matchAll(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/gm)].map((m) => ({
        level: m[1].length,
        title: m[2],
      })),
    );
}
function ids(text) {
  return [
    ...text.matchAll(
      /\b(?:RLAB-(?:TASK|SRC|KB|P3-SRC)|V1-SRC|SB-SRC|ADR|V1-[A-Z]+)-[A-Za-z0-9-]+\b/g,
    ),
  ]
    .map((m) => m[0])
    .sort();
}
function normalizedRelations(text) {
  return text
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "!=")
    .replace(/≈/g, "~=")
    .replace(/\s+/g, "");
}
function relationChanges(original, translated) {
  const actual = normalizedRelations(translated);
  return [...original.matchAll(/\b[A-Za-z_][A-Za-z0-9_.%]*\s*[≥≤≠]\s*-?\d+(?:\.\d+)?/g)]
    .map((m) => m[0])
    .filter((expression) => !actual.includes(normalizedRelations(expression)));
}
function slug(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}_\- ]/gu, "")
    .replace(/ /g, "-");
}
function addAnchors(body, source) {
  const used = new Map(),
    anchors = headings(source).map((h) => {
      const base = slug(h.title),
        n = used.get(base) ?? 0;
      used.set(base, n + 1);
      return n ? `${base}-${n}` : base;
    });
  let n = 0;
  return segments(body)
    .map((s) =>
      s.code
        ? s.text
        : s.text.replace(/^( {0,3}#{1,6}\s+.+?)\s*$/gm, (line) => {
            const id = anchors[n++];
            return id ? `<!-- english-original-anchor --> <a id="${id}"></a>\n${line}` : line;
          }),
    )
    .join("");
}
function local(href) {
  return href && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href);
}
function resolved(from, href) {
  const match = href.match(/^([^?#]*)([?#].*)?$/);
  let file;
  try {
    file = decodeURIComponent(match?.[1] ?? href);
  } catch {
    return null;
  }
  if (file.includes("\\") || file.startsWith("/") || /^[A-Za-z]:/.test(file)) return null;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), file));
  return target === ".." || target.startsWith("../") ? null : { target, suffix: match?.[2] ?? "" };
}
function inlineRanges(text) {
  const ranges = [];
  for (let i = 0; i < text.length; ) {
    if (text[i] !== "`") {
      i++;
      continue;
    }
    let slashes = 0;
    for (let n = i - 1; n >= 0 && text[n] === "\\"; n--) slashes++;
    if (slashes % 2) {
      i++;
      continue;
    }
    let end = i;
    while (text[end] === "`") end++;
    const length = end - i;
    let matched = false;
    for (let j = end; j < text.length; ) {
      if (text[j] !== "`") {
        j++;
        continue;
      }
      let close = j;
      while (text[close] === "`") close++;
      if (close - j === length) {
        ranges.push([i, close]);
        i = close;
        matched = true;
        break;
      }
      j = close;
    }
    if (!matched) i = end;
  }
  return ranges;
}
function insideInline(offset, ranges) {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}
function replaceOutsideInline(text, expression, replace) {
  const ranges = inlineRanges(text);
  return text.replace(expression, (...args) =>
    insideInline(args.at(-2), ranges) ? args[0] : replace(...args),
  );
}
export function rewriteLinks(body, source, target, mapping, rewritten = false) {
  const reverse = new Map([...mapping].map(([a, b]) => [b, a]));
  const convert = (href) => {
    if (!local(href)) return href;
    const found = resolved(rewritten ? target : source, href);
    if (!found) return href;
    const canonical = rewritten ? (reverse.get(found.target) ?? found.target) : found.target;
    return (
      rel(target, mapping.get(canonical) ?? canonical)
        .split("/")
        .map(encodeURIComponent)
        .join("/") + found.suffix
    );
  };
  return segments(body)
    .map((s) => {
      if (s.code) return s.text;
      let text = replaceOutsideInline(
        s.text,
        /(!?\[[^\]\r\n]*\]\()(?:<([^>]+)>|([^\s)]+))([^)]*\))/g,
        (_all, a, angle, plain, z) => `${a}${angle ? `<${convert(angle)}>` : convert(plain)}${z}`,
      );
      text = replaceOutsideInline(
        text,
        /^( {0,3}\[[^\]]+\]:\s*)(?:<([^>]+)>|(\S+))(.*)$/gm,
        (_all, a, angle, plain, z) => `${a}${angle ? `<${convert(angle)}>` : convert(plain)}${z}`,
      );
      return replaceOutsideInline(
        text,
        /(\b(?:href|src)=["'])([^"']+)(["'])/g,
        (_all, a, href, z) => a + convert(href) + z,
      );
    })
    .join("");
}
function links(text) {
  return segments(text)
    .filter((s) => !s.code)
    .flatMap((s) => {
      const ranges = inlineRanges(s.text),
        prose = (m) => !insideInline(m.index, ranges);
      return [
        ...[...s.text.matchAll(/!?\[[^\]\r\n]*\]\((?:<([^>]+)>|([^\s)]+))[^)]*\)/g)]
          .filter(prose)
          .map((m) => m[1] ?? m[2]),
        ...[...s.text.matchAll(/^ {0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm)]
          .filter(prose)
          .map((m) => m[1] ?? m[2]),
        ...[...s.text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].filter(prose).map((m) => m[1]),
      ];
    });
}
function linkErrors(root, target, text) {
  const unsupported = segments(text)
    .filter((s) => !s.code)
    .flatMap((s) => {
      const ranges = inlineRanges(s.text);
      const recognized = [...s.text.matchAll(/!?\[[^\]\r\n]*\]\((?:<([^>]+)>|([^\s)]+))[^)]*\)/g)]
        .filter((m) => !insideInline(m.index, ranges))
        .map((m) => [m.index, m.index + m[0].length]);
      return [...s.text.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))[^)]*\)/g)]
        .filter(
          (m) =>
            !insideInline(m.index, ranges) &&
            !recognized.some(([start, end]) => m.index >= start && m.index < end) &&
            local(m[1] ?? m[2]),
        )
        .map((m) => ({ code: "UNSUPPORTED_LOCAL_LINK_SYNTAX", href: m[1] ?? m[2] }));
    });
  return [
    ...unsupported,
    ...links(text)
      .filter(local)
      .flatMap((href) => {
        const found = resolved(target, href);
        return !found
          ? [{ code: "LINK_OUTSIDE_WORKSPACE", href }]
          : fs.existsSync(path.join(root, found.target))
            ? []
            : [{ code: "MISSING_LOCAL_LINK", href, target: found.target }];
      }),
  ];
}
function notice(body, entry) {
  const text = `<!-- english-notice:start -->\n> English translation of [\`${entry.source}\`](${rel(entry.target, entry.source)}). Source SHA-256: \`${entry.translated_source_sha256}\`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.\n<!-- english-notice:end -->\n\n`;
  const fm = body.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return fm ? fm[0] + "\n" + text + body.slice(fm[0].length).replace(/^\s*\n/, "") : text + body;
}
function hanLines(body) {
  return segments(noFrontmatter(cleanGenerated(body)))
    .filter((s) => !s.code)
    .flatMap((s) => s.text.split(/\r?\n/))
    .map((line) => line.replace(/`[^`]*`/g, "").replace(/<[^>]*>/g, ""))
    .filter((line) => /\p{Script=Han}/u.test(line))
    .map((line) => ({ line_sha256: sha(line), text: line }));
}
function summary(entries, excludedSharedRaw = []) {
  return {
    originals: entries.length,
    markdown_files_inventoried: entries.length + excludedSharedRaw.length,
    authored_artifact_documents: entries.filter(
      (e) => e.artifact_role === "project_authored_artifact_narrative",
    ).length,
    shared_raw_evidence: excludedSharedRaw.length,
    translations_required: entries.filter((e) => e.kind === "translation_required").length,
    translated: entries.filter((e) => e.kind === "translation_required" && e.target_sha256).length,
    original_english: entries.filter((e) => e.kind === "original_english").length,
    existing_english_companions: entries.filter((e) => e.kind === "existing_english_companion")
      .length,
    missing: entries.filter((e) => e.errors.some((i) => i.code === "MISSING_TRANSLATION")).length,
    stale: entries.filter((e) => e.errors.some((i) => i.code === "SOURCE_CHANGED")).length,
    errors: entries.reduce((n, e) => n + e.errors.length, 0),
    warnings: entries.reduce((n, e) => n + e.warnings.length, 0),
  };
}
function index(entries, counts, excludedSharedRaw) {
  const groups = new Map();
  for (const entry of entries) {
    const group = entry.source.startsWith("docs/")
      ? entry.source.split("/")[1]
      : entry.source.split("/")[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(entry);
  }
  return (
    `# Reflection Lab — English documentation\n\n[English README](../../README.en.md) · [User guide](../11-v1/USER_GUIDE.en.md) · [Canonical Traditional Chinese README](../../README.md)\n\nEnglish versions of the project's human-readable Markdown live here. They do not create another task registry, change accepted contracts, or convert historical research into current product claims. Original documents, source, immutable evidence and active task JSON remain authoritative. English Wiki pages are translated readable snapshots outside the active Wiki parser.\n\nThe inventory includes all tracked and unignored project Markdown, including authored reports under artifacts/. Exact captured source copies and generated browser failure contexts stay shared only after file-specific evidence checks; each exclusion is listed below. English mirrors are excluded from the source inventory to avoid recursive translation. Ignored private files and generated dependencies are outside the Git inventory.\n\nEach translated page identifies its exact source SHA-256. [The manifest](manifest.json) records coverage/currentness and English hashes. Already-English originals and maintained English companions are linked directly. Code, APIs, stable IDs, data, schemas, task JSON and raw test results remain shared. Source changes require a refresh.\n\nStatus: **${counts.errors ? "IN_PROGRESS" : "STRUCTURAL_CHECKS_PASS"}**; ${counts.translated}/${counts.translations_required} translated, ${counts.stale} stale, ${counts.missing} missing across ${counts.originals} originals, including ${counts.authored_artifact_documents} authored artifact documents. ${counts.shared_raw_evidence} verified raw evidence files remain shared. Structural checks cannot prove every sentence's meaning; independent sample review is recorded separately.\n\n\`\`\`powershell\nnode scripts/validation/english-docs.mjs inventory\nnode scripts/validation/english-docs.mjs check\n\`\`\`\n\n` +
    [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([group, rows]) =>
          `## ${group}\n\n| Canonical document | English | State |\n| --- | --- | --- |\n` +
          rows
            .map(
              (e) =>
                `| [\`${e.source}\`](${rel(`${outputRoot}/index.md`, e.source)}) | ${e.target_sha256 ? `[English](${rel(`${outputRoot}/index.md`, e.target)})` : "Pending"} | ${e.errors.length ? e.errors.map((i) => i.code).join(", ") : e.kind === "translation_required" ? "Translated snapshot" : "Already English / companion"} |`,
            )
            .join("\n"),
      )
      .join("\n\n") +
    "\n\n## Shared raw Markdown evidence\n\nThese files are preserved verbatim and are not counted as translated project narratives. The manifest records their full SHA-256 values and evidence hashes.\n\n| File | Classification and reason | Confirmation |\n| --- | --- | --- |\n" +
    excludedSharedRaw
      .map(
        (e) =>
          `| [\`${e.source}\`](${rel(`${outputRoot}/index.md`, e.source)}) | ${e.classification}: ${e.reason} | ${e.confirmation}${e.evidence ? `; [capture evidence](${rel(`${outputRoot}/index.md`, e.evidence.path)})` : e.canonical_source ? `; [canonical bytes](${rel(`${outputRoot}/index.md`, e.canonical_source)})` : ""} |`,
      )
      .join("\n") +
    "\n"
  );
}
export function validateEnglishDocs(
  root,
  { finalize = false, verifyRecorded = false, sourcePaths = null, linkMapping = null } = {},
) {
  const { sources, excluded_shared_raw: excludedSharedRaw } = inspectDocumentationSources(
      root,
      sourcePaths,
    ),
    mapping = linkMapping ?? new Map(sources.map((e) => [e.source, e.target]));
  const exceptionsPath = path.join(root, outputRoot, "translation-exceptions.json");
  const exceptions = fs.existsSync(exceptionsPath)
    ? (JSON.parse(fs.readFileSync(exceptionsPath, "utf8")).entries ?? [])
    : [];
  const entries = sources.map((source) => {
    const entry = {
      ...source,
      translated_source_sha256: null,
      target_sha256: null,
      target_bytes: null,
      translated_at: null,
      executor: null,
      model_id: null,
      errors: source.classification_error ? [source.classification_error] : [],
      warnings: [],
    };
    const file = path.join(root, source.target);
    if (!fs.existsSync(file)) {
      entry.errors.push({ code: "MISSING_TRANSLATION" });
      return entry;
    }
    let bytes = fs.readFileSync(file),
      text = bytes.toString("utf8");
    if (source.kind === "original_english") {
      entry.translated_source_sha256 = source.source_sha256;
      entry.target_sha256 = sha(bytes);
      entry.target_bytes = bytes.byteLength;
      entry.warnings.push(
        ...linkErrors(root, source.target, text).map((e) => ({
          ...e,
          code: "ORIGINAL_OR_COMPANION_LINK_ISSUE",
        })),
      );
      entry.errors.push(
        ...hanLines(text).map((line) => ({ code: "HAN_PROSE_REQUIRES_REVIEW", ...line })),
      );
      return entry;
    }
    const parsed = parseTranslation(text);
    if (
      !parsed ||
      parsed.metadata.path !== source.source ||
      !/^[a-f0-9]{64}$/i.test(parsed.metadata.sha256 ?? "")
    ) {
      entry.errors.push({ code: "INVALID_TRANSLATION_PROVENANCE" });
      return entry;
    }
    entry.translated_source_sha256 = parsed.metadata.sha256.toLowerCase();
    entry.translated_at = parsed.metadata.translated_at ?? null;
    entry.executor = parsed.metadata.executor ?? null;
    entry.model_id = parsed.metadata.model_id ?? null;
    if (!Number.isFinite(Date.parse(entry.translated_at)) || entry.executor !== "Codex")
      entry.errors.push({ code: "INVALID_TRANSLATION_METADATA" });
    if (entry.translated_source_sha256 !== source.source_sha256)
      entry.errors.push({
        code: "SOURCE_CHANGED",
        translated: entry.translated_source_sha256,
        current: source.source_sha256,
      });
    const original = fs.readFileSync(path.join(root, source.source), "utf8").replace(/^\uFEFF/, "");
    let body = cleanGenerated(parsed.body);
    const originalCode = segments(original)
        .filter((s) => s.code)
        .map((s) => s.text),
      englishCode = segments(body)
        .filter((s) => s.code)
        .map((s) => s.text);
    if (JSON.stringify(originalCode) !== JSON.stringify(englishCode))
      entry.errors.push({
        code: "VERBATIM_CODE_CHANGED",
        original_fences: originalCode.length,
        english_fences: englishCode.length,
      });
    if (
      JSON.stringify(headings(original).map((h) => h.level)) !==
      JSON.stringify(headings(body).map((h) => h.level))
    )
      entry.errors.push({ code: "SECTION_STRUCTURE_CHANGED" });
    if (JSON.stringify(ids(original)) !== JSON.stringify(ids(body)))
      entry.errors.push({ code: "TECHNICAL_IDS_CHANGED" });
    const changedRelations = relationChanges(original, body);
    if (changedRelations.length)
      entry.errors.push({ code: "TECHNICAL_RELATION_CHANGED", expressions: changedRelations });
    if (finalize && !entry.errors.length) {
      body = rewriteLinks(
        body,
        source.source,
        source.target,
        mapping,
        parsed.metadata.links === "english-relative",
      );
      body = notice(addAnchors(body, original), entry);
      text =
        `<!-- english-source: ${JSON.stringify({ ...parsed.metadata, links: "english-relative" })} -->\n` +
        body;
      if (!bytes.equals(Buffer.from(text))) fs.writeFileSync(file, text);
      bytes = fs.readFileSync(file);
    }
    entry.target_sha256 = sha(bytes);
    entry.target_bytes = bytes.byteLength;
    entry.errors.push(...linkErrors(root, source.target, text));
    const allowed = new Set(
      exceptions.filter((x) => x.source === source.source).map((x) => x.line_sha256),
    );
    entry.errors.push(
      ...hanLines(body)
        .filter((x) => !allowed.has(x.line_sha256))
        .map((x) => ({ code: "HAN_PROSE_REQUIRES_REVIEW", ...x })),
    );
    return entry;
  });
  if (finalize)
    for (const entry of entries.filter((e) => e.kind === "original_english")) {
      const bytes = fs.readFileSync(path.join(root, entry.source));
      entry.source_sha256 = sha(bytes);
      entry.source_bytes = bytes.byteLength;
      entry.translated_source_sha256 = entry.source_sha256;
      entry.target_sha256 = entry.source_sha256;
      entry.target_bytes = bytes.byteLength;
    }
  const globalErrors = [];
  if (verifyRecorded) {
    const manifestPath = path.join(root, outputRoot, "manifest.json");
    if (!fs.existsSync(manifestPath)) globalErrors.push({ code: "MANIFEST_NOT_FINALIZED" });
    else {
      const recorded = JSON.parse(fs.readFileSync(manifestPath, "utf8")),
        bySource = new Map((recorded.entries ?? []).map((e) => [e.source, e]));
      if (bySource.size !== (recorded.entries ?? []).length)
        globalErrors.push({ code: "DUPLICATE_MANIFEST_SOURCE" });
      for (const entry of entries) {
        const previous = bySource.get(entry.source);
        if (!previous) entry.errors.push({ code: "SOURCE_NOT_IN_MANIFEST" });
        else if (previous.source_sha256 !== entry.source_sha256)
          entry.errors.push({ code: "MANIFEST_SOURCE_CHANGED" });
        else if (previous.target_sha256 !== entry.target_sha256)
          entry.errors.push({ code: "TRANSLATION_HASH_CHANGED" });
      }
      for (const old of bySource.keys())
        if (
          (sourcePaths === null || sourcePaths.includes(old)) &&
          !entries.some((e) => e.source === old)
        )
          globalErrors.push({ code: "MANIFEST_SOURCE_REMOVED", source: old });
      const rawBySource = new Map((recorded.excluded_shared_raw ?? []).map((e) => [e.source, e]));
      if (rawBySource.size !== (recorded.excluded_shared_raw ?? []).length)
        globalErrors.push({ code: "DUPLICATE_MANIFEST_RAW_EVIDENCE" });
      for (const raw of excludedSharedRaw) {
        const previous = rawBySource.get(raw.source);
        if (!previous)
          globalErrors.push({ code: "RAW_EVIDENCE_NOT_IN_MANIFEST", source: raw.source });
        else if (JSON.stringify(previous) !== JSON.stringify(raw))
          globalErrors.push({ code: "RAW_EVIDENCE_OR_CLASSIFICATION_CHANGED", source: raw.source });
      }
      for (const old of rawBySource.keys())
        if (
          (sourcePaths === null || sourcePaths.includes(old)) &&
          !excludedSharedRaw.some((e) => e.source === old)
        )
          globalErrors.push({ code: "MANIFEST_RAW_EVIDENCE_REMOVED_OR_RECLASSIFIED", source: old });
    }
  }
  const counts = summary(entries, excludedSharedRaw);
  counts.errors += globalErrors.length;
  const result = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    status: counts.errors ? "INCOMPLETE" : "PASS",
    summary: counts,
    global_errors: globalErrors,
    scope:
      sourcePaths === null
        ? "All tracked and unignored project Markdown, including authored artifact narratives; verified per-file captured sources and generated failure contexts remain shared raw evidence. English mirrors are not source documents."
        : "Only the explicitly selected source paths; this result is not complete/current project-document coverage. Selected finalization never writes the corpus manifest, index or validation report.",
    scope_complete: sourcePaths === null,
    ...(sourcePaths === null ? {} : { selected_source_paths: [...sourcePaths] }),
    inventory_strategy:
      sourcePaths !== null
        ? "explicit_source_paths_no_git_enumeration"
        : fs.existsSync(path.join(root, ".git"))
          ? "git_tracked_and_unignored"
          : "filesystem_fixture_without_git",
    limits: [
      "Structural checks do not prove full semantic fidelity; independent sample review is separate.",
      "Local file links are checked; renderer-specific anchors and remote availability are not guaranteed.",
      "Translation preserves source-date claims; it is not new implementation, scientific evidence, legal approval or live-model validation.",
    ],
    entries,
    excluded_shared_raw: excludedSharedRaw,
  };
  if (finalize && sourcePaths === null) {
    saveJSON(root, `${outputRoot}/manifest.json`, result);
    saveJSON(root, `${outputRoot}/validation.json`, result);
    fs.writeFileSync(
      path.join(root, outputRoot, "index.md"),
      index(entries, counts, excludedSharedRaw),
    );
  }
  return result;
}
function main() {
  const root = process.cwd(),
    command = process.argv[2] ?? "check";
  if (command === "inventory") {
    const { sources, excluded_shared_raw } = inspectDocumentationSources(root);
    saveJSON(root, `${outputRoot}/source-inventory.json`, {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      sources,
      excluded_shared_raw,
      inventory_strategy: fs.existsSync(path.join(root, ".git"))
        ? "git_tracked_and_unignored"
        : "filesystem_fixture_without_git",
    });
    console.log(
      JSON.stringify({
        status: "INVENTORIED",
        originals: sources.length,
        translations_required: sources.filter((x) => x.kind === "translation_required").length,
        authored_artifact_documents: sources.filter(
          (x) => x.artifact_role === "project_authored_artifact_narrative",
        ).length,
        shared_raw_evidence: excluded_shared_raw.length,
      }),
    );
  } else if (command === "check" || command === "finalize") {
    const result = validateEnglishDocs(root, {
      finalize: command === "finalize",
      verifyRecorded: command === "check",
    });
    console.log(JSON.stringify({ status: result.status, ...result.summary }));
    if (result.status !== "PASS") process.exitCode = 1;
  } else {
    console.error("Usage: node scripts/validation/english-docs.mjs inventory|finalize|check");
    process.exitCode = 2;
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main();
