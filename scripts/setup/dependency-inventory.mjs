import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_OUTPUT = "docs/01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY-r2.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (name) => JSON.parse(readFileSync(name, "utf8"));
const root = process.cwd();
const manifest = readJson("package.json");
const lock = readJson("package-lock.json");
const args = process.argv.slice(2);
const mode = args[0];
const output = args[1] ?? DEFAULT_OUTPUT;
if (
  !["--write", "--check"].includes(mode) ||
  args.length > 2 ||
  !/^docs\/01-compliance\/[A-Za-z0-9_-]*DEPENDENCY_LICENSE_INVENTORY(?:-[A-Za-z0-9_-]+)?\.json$/.test(
    output,
  )
) {
  throw new Error(
    "Usage: node scripts/setup/dependency-inventory.mjs <--write|--check> [docs/01-compliance/<version>DEPENDENCY_LICENSE_INVENTORY.json]",
  );
}
const rootDependencies = Object.fromEntries(
  Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).sort(([a], [b]) =>
    a.localeCompare(b),
  ),
);
const artifact = (name) => ({
  path: name.replaceAll("\\", "/"),
  sha256: sha256(readFileSync(name)),
  bytes: readFileSync(name).byteLength,
});
const licenseName =
  /^(?:licen[cs]e|copying|notice|third[-_]party[-_]licen[cs]e|third[-_]party[-_]notices?)(?:[._ -].*)?$/i;
const role = (name) =>
  manifest.dependencies?.[name]
    ? "directRuntimeDeclaration"
    : manifest.devDependencies?.[name]
      ? "directDevelopmentDeclaration"
      : "transitive";
const embeddedSources = {
  "@react-three/fiber": ["node_modules/@react-three/fiber/react-reconciler/index.js"],
  esrecurse: ["node_modules/esrecurse/esrecurse.js"],
  imurmurhash: ["node_modules/imurmurhash/README.md"],
  "natural-compare": ["node_modules/natural-compare/README.md"],
};
function safePackagePath(name) {
  if (!name.startsWith("node_modules/") || path.resolve(name).startsWith(root + path.sep) === false)
    throw new Error(`Invalid lockfile package path: ${name}`);
  return name;
}
function records() {
  return Object.entries(lock.packages)
    .filter(([name]) => name !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entry]) => {
      safePackagePath(name);
      const manifestPath = `${name}/package.json`;
      const installed = existsSync(manifestPath);
      const local = installed ? readJson(manifestPath) : null;
      const files = installed
        ? readdirSync(name, { withFileTypes: true })
            .filter((file) => file.isFile() && licenseName.test(file.name))
            .map((file) => artifact(`${name}/${file.name}`))
            .sort((a, b) => a.path.localeCompare(b.path))
        : [];
      const pkgName =
        local?.name ?? entry.name ?? name.slice(name.lastIndexOf("node_modules/") + 13);
      const license = local?.license ?? entry.license ?? null;
      const readmes =
        installed && files.length === 0
          ? readdirSync(name, { withFileTypes: true })
              .filter((file) => file.isFile() && /^readme(?:\..*)?$/i.test(file.name))
              .map((file) => artifact(`${name}/${file.name}`))
          : [];
      return {
        path: name,
        name: pkgName,
        version: entry.version,
        installed,
        installed_version: local?.version ?? null,
        declaration_role: role(pkgName),
        lock_dev: entry.dev ?? false,
        lock_optional: entry.optional ?? false,
        cpu: entry.cpu ?? null,
        os: entry.os ?? null,
        license,
        lock_license: entry.license ?? null,
        lock_resolved: entry.resolved ?? null,
        lock_integrity: entry.integrity ?? null,
        repository: local?.repository ?? null,
        manifest: installed ? artifact(manifestPath) : null,
        license_artifact_status: !installed
          ? "OPTIONAL_PLATFORM_PACKAGE_NOT_INSTALLED"
          : files.length > 0
            ? "LOCAL_LICENSE_OR_NOTICE_HASHED"
            : "ROOT_LICENSE_ARTIFACT_NOT_DETECTED",
        license_files: files,
        readme_candidates: readmes,
        embedded_license_evidence: (embeddedSources[pkgName] ?? []).map(artifact),
        distribution_scope:
          "UNDETERMINED_BY_METADATA; dev flag does not exclude runtime imports or bundled code",
      };
    });
}
function tally(packages) {
  return packages.reduce((values, pkg) => {
    const key = typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license);
    values[key] = (values[key] ?? 0) + 1;
    return values;
  }, {});
}
function snapshot() {
  const packages = records(),
    installed = packages.filter((pkg) => pkg.installed);
  const missing = packages.filter((pkg) => !pkg.installed && !pkg.lock_optional);
  if (missing.length)
    throw new Error(
      `Missing non-optional installed packages: ${missing.map((pkg) => pkg.path).join(", ")}`,
    );
  for (const pkg of installed)
    if (pkg.version !== pkg.installed_version)
      throw new Error(`Installed version differs from lockfile: ${pkg.path}`);
  return {
    schema_version: 1,
    recorded_at_utc: new Date().toISOString(),
    scope:
      "V1 root lockfile plus locally installed package metadata and root license/NOTICE artifact hashes; not complete redistribution or legal clearance",
    supersedes_snapshot: "docs/01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY.json",
    generator: artifact("scripts/setup/dependency-inventory.mjs"),
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    lockfile: artifact("package-lock.json"),
    root_package_at_snapshot: artifact("package.json"),
    direct_dependencies: rootDependencies,
    lock_package_count: packages.length,
    installed_package_count: installed.length,
    omitted_optional_package_count: packages.length - installed.length,
    installed_license_counts: tally(installed),
    lock_license_counts: tally(packages),
    root_license_decision: "UNDECIDED_BY_USER; no project license is inferred from dependencies",
    upstream_license_reviews: [
      {
        package: "@react-three/fiber",
        version: "9.8.2",
        url: "https://raw.githubusercontent.com/pmndrs/react-three-fiber/v9.8.2/LICENSE",
        status: "VERIFIED_OFFICIAL_FIXED_TAG_MIT",
        acquired_copy: null,
        reviewed_at: "2026-10-27",
        note: "Local tarball omits root LICENSE; upstream notice names Poimandres. Bundled react-reconciler has separate Meta MIT headers.",
      },
      {
        package: "lightningcss",
        version: "1.33.0",
        url: "https://raw.githubusercontent.com/parcel-bundler/lightningcss/v1.33.0/LICENSE",
        status: "VERIFIED_OFFICIAL_FIXED_TAG_MPL_2_0",
        acquired_copy: "node_modules/lightningcss/LICENSE",
        reviewed_at: "2026-10-27",
        note: "Tooling use is separate from redistributing the tool or native binary; actual release inclusion remains to be audited.",
      },
    ],
    limitations: [
      "The installed snapshot is platform-specific. Other optional platform binaries require their own artifact inspection when distributed.",
      "Manifest SPDX values alone do not describe bundled upstream licenses. Vite LICENSE.md and Rolldown THIRD-PARTY-LICENSE contain additional notices.",
      "Packages without a matching root artifact require README, embedded header or fixed upstream license review; absence is not permission.",
      "Browser binaries, native Steam Audio SDK, HRTF data, user-imported audio and remote API terms are outside this npm inventory.",
      "A public release still requires actual bundle/WASM/data inclusion review and preservation of applicable license and NOTICE texts.",
    ],
    packages,
  };
}
if (mode === "--write") {
  const report = snapshot();
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  process.stdout.write(
    JSON.stringify({
      status: "RECORDED",
      output,
      lockPackages: report.lock_package_count,
      installed: report.installed_package_count,
      omittedOptional: report.omitted_optional_package_count,
      installedLicenses: report.installed_license_counts,
    }) + "\n",
  );
} else {
  const prior = readJson(output);
  if (prior.lockfile.sha256 !== sha256(readFileSync("package-lock.json")))
    throw new Error(
      "Dependency inventory lockfile is stale; record a new version instead of overwriting evidence",
    );
  if (prior.generator.sha256 !== sha256(readFileSync("scripts/setup/dependency-inventory.mjs")))
    throw new Error("Dependency inventory generator changed; record a new version");
  if (JSON.stringify(prior.direct_dependencies) !== JSON.stringify(rootDependencies))
    throw new Error("Dependency inventory direct dependency declarations changed");
  const expected = new Map(prior.packages.map((pkg) => [pkg.path, pkg]));
  const current = snapshot();
  for (const pkg of current.packages) {
    const recorded = expected.get(pkg.path);
    if (
      !recorded ||
      pkg.version !== recorded.version ||
      pkg.lock_integrity !== recorded.lock_integrity ||
      JSON.stringify(pkg.license) !== JSON.stringify(recorded.license)
    )
      throw new Error(`Dependency metadata differs: ${pkg.path}`);
    if (pkg.installed && recorded.installed) {
      if (
        pkg.manifest.sha256 !== recorded.manifest.sha256 ||
        JSON.stringify(pkg.license_files) !== JSON.stringify(recorded.license_files) ||
        JSON.stringify(pkg.readme_candidates) !== JSON.stringify(recorded.readme_candidates) ||
        JSON.stringify(pkg.embedded_license_evidence) !==
          JSON.stringify(recorded.embedded_license_evidence)
      )
        throw new Error(`Installed package/license artifact differs: ${pkg.path}`);
    }
  }
  process.stdout.write(
    JSON.stringify({
      status: "PASS",
      scope:
        "lock metadata plus installed license artifacts where snapshot platform matches; no legal or bundle-completeness claim",
      inventory: output,
      snapshotPlatform: prior.environment.platform,
      currentPlatform: process.platform,
      lockPackages: current.lock_package_count,
      installed: current.installed_package_count,
      omittedOptional: current.omitted_optional_package_count,
    }) + "\n",
  );
}
