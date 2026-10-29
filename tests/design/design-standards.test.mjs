import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkSkillBundle,
  restoreSkillBundle,
  loadManifest,
  validateDesignStandards,
} from "../../scripts/setup/emil-skills.mjs";

const project = fileURLToPath(new URL("../../", import.meta.url));

async function fixture(t, { bundle = false, design = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "reflection-design-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  const manifest = await loadManifest(project);
  if (bundle) {
    for (const file of manifest.files) {
      const destination = path.join(root, file.localPath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(project, file.localPath), destination);
    }
  }
  if (design) {
    await fs.mkdir(path.join(root, "docs/05-ux"), { recursive: true });
    for (const file of ["DESIGN_TOKENS.json", "DESIGN_TOKENS.schema.json", "COMPONENT_STATES.json"])
      await fs.copyFile(
        path.join(project, "docs/05-ux", file),
        path.join(root, "docs/05-ux", file),
      );
  }
  return { root, manifest };
}

async function edit(root, name, mutate) {
  const target = path.join(root, "docs/05-ux", name);
  const value = JSON.parse(await fs.readFile(target, "utf8"));
  mutate(value);
  await fs.writeFile(target, JSON.stringify(value));
}

test("curated upstream bytes match pinned Git blobs and SHA256; repeat check is read-only", async () => {
  const manifest = await loadManifest(project);
  assert.equal(manifest.installation.global, false);
  assert.equal(manifest.installation.symlinks, false);
  const first = await checkSkillBundle(project);
  assert.equal(first.ok, true);
  assert.equal(first.files.length, 16);
  assert.deepEqual(await checkSkillBundle(project), first);
});

test("modified upstream is detected and restore refuses all writes before fetching", async (t) => {
  const { root, manifest } = await fixture(t, { bundle: true });
  const target = path.join(root, manifest.files[0].localPath);
  await fs.appendFile(target, "modified");
  let calls = 0;
  assert.equal((await checkSkillBundle(root, { manifest })).ok, false);
  await assert.rejects(
    restoreSkillBundle(root, {
      manifest,
      fetchImpl: async () => {
        calls++;
      },
    }),
    /differ/,
  );
  assert.equal(calls, 0);
  assert.match(await fs.readFile(target, "utf8"), /modified$/);
});

test("missing-files check is an offline dry run with no created destinations", async (t) => {
  const { root, manifest } = await fixture(t);
  const result = await checkSkillBundle(root, { manifest });
  assert.equal(result.ok, false);
  assert.equal(result.files.filter((f) => f.status === "MISSING").length, 16);
  assert.deepEqual(await fs.readdir(root), []);
});

test("mock restore uses only pinned raw URLs, writes exact bytes and is idempotent", async (t) => {
  const { root, manifest } = await fixture(t);
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    const prefix = `https://raw.githubusercontent.com/emilkowalski/skills/${manifest.commit}/`;
    assert.ok(url.startsWith(prefix));
    assert.equal(options.redirect, "error");
    const file = manifest.files.find((f) => url === prefix + f.sourcePath);
    assert.ok(file);
    return new Response(await fs.readFile(path.join(project, file.localPath)));
  };
  const first = await restoreSkillBundle(root, { manifest, fetchImpl });
  assert.equal(first.ok, true);
  assert.equal(first.created.length, 16);
  const second = await restoreSkillBundle(root, { manifest, fetchImpl });
  assert.equal(second.ok, true);
  assert.deepEqual(second.created, []);
  assert.equal(calls, 16);
});

test("hash mismatch stages no files, even when earlier responses were valid", async (t) => {
  const { root, manifest } = await fixture(t);
  let calls = 0;
  const fetchImpl = async () => {
    const file = manifest.files[calls++];
    const bytes = await fs.readFile(path.join(project, file.localPath));
    if (calls === 2) bytes[0] ^= 1;
    return new Response(bytes);
  };
  await assert.rejects(restoreSkillBundle(root, { manifest, fetchImpl }), /pin mismatch/);
  assert.equal(calls, 2);
  assert.deepEqual(await fs.readdir(root), []);
});

test("oversize download is rejected without creating files", async (t) => {
  const { root, manifest } = await fixture(t);
  await assert.rejects(
    restoreSkillBundle(root, {
      manifest,
      fetchImpl: async () => new Response(new Uint8Array(manifest.files[0].bytes + 1)),
    }),
    /exceeds pinned size/,
  );
  assert.deepEqual(await fs.readdir(root), []);
});

test("manifest cannot redirect restoration outside curated project scope", async (t) => {
  const { root, manifest } = await fixture(t);
  manifest.files[0].localPath = "../outside";
  await assert.rejects(checkSkillBundle(root, { manifest }), /Invalid target/);
  manifest.files[0].localPath = "third_party/emil-skills.LICENSE";
  manifest.commit = "main";
  await assert.rejects(checkSkillBundle(root, { manifest }), /Unexpected upstream/);
});

test("static standards validate all token categories, contrast pairs and component states", async () => {
  const result = await validateDesignStandards(project);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.componentCount, 19);
  assert.equal(result.ratios.length, 24);
  assert.match(result.scope, /UI, browser, physics, audio, hearing NOT RUN/);
});

test("bad contrast is detected from altered tokens rather than a snapshot", async (t) => {
  const { root } = await fixture(t, { design: true });
  await edit(root, "DESIGN_TOKENS.json", (data) => {
    data.groups.color.textPrimary.$value = "#11151D";
  });
  const result = await validateDesignStandards(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /Contrast below/.test(e)));
});

test("invalid units, off-grid spacing and invalid Bezier are rejected", async (t) => {
  const { root } = await fixture(t, { design: true });
  await edit(root, "DESIGN_TOKENS.json", (data) => {
    data.groups.spacing["1"].$value = "5px";
    data.groups.sizing.row.$value = "32ms";
    data.groups.motion.easing.out.$value = [2, 1, 0.32, 1];
  });
  const { errors } = await validateDesignStandards(root);
  assert.ok(errors.some((e) => /4px grid/.test(e)));
  assert.ok(errors.some((e) => /invalid unit/.test(e)));
  assert.ok(errors.some((e) => /invalid cubic/.test(e)));
});

test("missing Focus, duplicate IDs and missing required component are rejected", async (t) => {
  const { root } = await fixture(t, { design: true });
  await edit(root, "COMPONENT_STATES.json", (data) => {
    delete data.commonStates.Focus;
    data.components.pop();
    data.components.push({ ...data.components[0] });
  });
  const { errors } = await validateDesignStandards(root);
  assert.ok(errors.some((e) => /Missing common state: Focus/.test(e)));
  assert.ok(errors.some((e) => /Duplicate component/.test(e)));
  assert.ok(errors.some((e) => /Missing component/.test(e)));
});

test("unknown state extensions and profiles do not silently fall back", async (t) => {
  const { root } = await fixture(t, { design: true });
  await edit(root, "COMPONENT_STATES.json", (data) => {
    data.components[0].profile = "unknown";
    data.components[0].extensions.push("InvisibleSuccess");
  });
  const { errors } = await validateDesignStandards(root);
  assert.ok(errors.some((e) => /Missing profile/.test(e)));
  assert.ok(errors.some((e) => /Unknown extension/.test(e)));
});

test("acoustic visualization cannot introduce an untracked color reference", async (t) => {
  const { root } = await fixture(t, { design: true });
  await edit(root, "DESIGN_TOKENS.json", (data) => {
    data.groups.acoustic.direct.$value = "color.unknown + solid + Direct label";
  });
  const result = await validateDesignStandards(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /missing canonical color reference/.test(e)));
});

test("governance keeps token color values unique and preserves scientific path semantics", async () => {
  const tokens = JSON.parse(await fs.readFile(path.join(project, "docs/05-ux/DESIGN_TOKENS.json")));
  const design = await fs.readFile(path.join(project, "docs/05-ux/DESIGN_SYSTEM.md"), "utf8");
  assert.match(design, /DESIGN_TOKENS\.json/);
  for (const color of Object.values(tokens.groups.color))
    assert.equal(design.includes(color.$value), false);
  assert.match(tokens.groups.acoustic.blocked.$description, /不送音訊/);
  assert.match(tokens.groups.acoustic.selected.$description, /不改 path type/);
  assert.match(tokens.groups.acoustic.direct.$description, /solver/);
  const motion = await fs.readFile(path.join(project, "docs/05-ux/MOTION_GUIDELINES.md"), "utf8");
  assert.match(motion, /UI spring.*Rapier grab/);
  assert.match(motion, /audio.*60 FPS|60 FPS.*audio/);
});
