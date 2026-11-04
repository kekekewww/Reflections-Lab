import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { executeLane } from "./s4-process.mjs";

async function fixture() {
  const root = resolve(process.cwd()),
    directory = resolve(root, ".cache", `s4-process-unit-${randomUUID()}`);
  assert.ok(!relative(root, directory).startsWith(".."));
  await mkdir(resolve(root, ".cache"), { recursive: true });
  await mkdir(directory, { recursive: false });
  return directory;
}
const env = () => ({ ...process.env });
async function receipt(directory) {
  return JSON.parse(await readFile(join(directory, "actual-exit.json"), "utf8"));
}
async function waitJson(path, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    await delay(20);
  }
  throw new Error("Pure Node test child did not publish its owned PID marker in time");
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}
function cleanupOwnedPids(pids) {
  for (const pid of [...pids].reverse()) {
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

test(
  "normal child exit preserves stdout, stderr, and an actual terminal receipt",
  { concurrency: false },
  async () => {
    const directory = await fixture();
    const result = await executeLane(
      ["-e", "console.log('normal-out');console.error('normal-err');"],
      env(),
      directory,
      5000,
    );
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.equal(result.spawned, true);
    assert.equal(result.terminal, true);
    assert.equal(result.interrupted, false);
    assert.equal(result.timedOut, false);
    assert.deepEqual(result.outputErrors, []);
    assert.match(await readFile(join(directory, "stdout.txt"), "utf8"), /normal-out/);
    assert.match(await readFile(join(directory, "stderr.txt"), "utf8"), /normal-err/);
    assert.equal((await receipt(directory)).status, 0);
  },
);

test(
  "a child assertion failure retains its nonzero actual exit rather than becoming a wrapper pass",
  { concurrency: false },
  async () => {
    const directory = await fixture();
    const result = await executeLane(
      ["-e", "console.error('owned-negative');process.exitCode=7;"],
      env(),
      directory,
      5000,
    );
    assert.equal(result.status, 7);
    assert.equal(result.terminal, true);
    assert.equal((await receipt(directory)).status, 7);
  },
);

test(
  "output open failure is terminal and never spawns the requested child",
  { concurrency: false },
  async () => {
    const directory = await fixture(),
      marker = join(directory, "must-not-spawn.txt");
    await mkdir(join(directory, "stdout.txt"));
    const source = `require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected-spawn');`;
    const result = await executeLane(["-e", source], env(), directory, 5000);
    assert.equal(result.spawned, false);
    assert.equal(result.childPid, null);
    assert.equal(result.status, null);
    assert.equal(result.terminal, true);
    assert.ok(result.outputErrors.length > 0);
    await assert.rejects(() => access(marker), { code: "ENOENT" });
    const stored = await receipt(directory);
    assert.equal(stored.spawned, false);
    assert.ok(stored.outputErrors.length > 0);
  },
);

test(
  "cancellation stops the owned Node process tree and is distinct from an ordinary lane failure",
  { concurrency: false },
  async (t) => {
    const directory = await fixture(),
      marker = join(directory, "owned-pids.json"),
      controller = new AbortController();
    const ownedPids = [];
    t.after(() => cleanupOwnedPids(ownedPids));
    const source = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({parent:process.pid,descendant:child.pid}));setInterval(()=>{},1000);`;
    const pending = executeLane(["-e", source], env(), directory, 5000, {
      signal: controller.signal,
      stopGraceMs: 100,
    });
    const pids = await waitJson(marker);
    ownedPids.push(pids.parent, pids.descendant);
    assert.equal(alive(pids.parent), true);
    assert.equal(alive(pids.descendant), true);
    controller.abort(new Error("unit controlled cancellation"));
    const result = await pending;
    assert.equal(result.interrupted, true);
    assert.equal(result.timedOut, false);
    assert.equal(result.terminal, true);
    assert.equal(
      alive(pids.parent),
      false,
      "Owned lane child must be gone before its terminal receipt",
    );
    assert.equal(alive(pids.descendant), false, "Owned descendant must not survive cancellation");
    assert.equal((await receipt(directory)).interrupted, true);
  },
);

test(
  "timeout stops the owned child and stores a bounded terminal failure receipt",
  { concurrency: false },
  async (t) => {
    const directory = await fixture(),
      marker = join(directory, "timeout-pid.json"),
      ownedPids = [];
    t.after(() => cleanupOwnedPids(ownedPids));
    const source = `require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);`;
    const started = Date.now();
    const pending = executeLane(["-e", source], env(), directory, 500, { stopGraceMs: 100 });
    const pids = await waitJson(marker);
    ownedPids.push(pids.pid);
    const result = await pending;
    assert.equal(result.timedOut, true);
    assert.equal(result.interrupted, false);
    assert.equal(result.terminal, true);
    assert.equal(alive(pids.pid), false);
    assert.ok(Date.now() - started < 6000, "A short pure Node timeout must not hang indefinitely");
    assert.equal((await receipt(directory)).timedOut, true);
  },
);

test(
  "an asynchronous output error stops the child and is saved in the receipt without an unhandled rejection",
  { concurrency: false },
  async (t) => {
    const directory = await fixture(),
      ownedPids = [];
    t.after(() => cleanupOwnedPids(ownedPids));
    const createLogStream = (path, options) => {
      const stream = createWriteStream(path, options);
      if (path.endsWith("stdout.txt"))
        stream.once("open", () =>
          setTimeout(
            () => stream.destroy(new Error("unit injected asynchronous output failure")),
            100,
          ),
        );
      return stream;
    };
    const result = await executeLane(
      ["-e", "setInterval(()=>console.log('owned-output'),10);"],
      env(),
      directory,
      5000,
      { createLogStream, stopGraceMs: 100 },
    );
    if (result.childPid) ownedPids.push(result.childPid);
    assert.equal(result.spawned, true);
    assert.equal(result.terminal, true);
    assert.ok(
      result.outputErrors.some((value) =>
        String(typeof value === "string" ? value : value.message).includes(
          "unit injected asynchronous output failure",
        ),
      ),
    );
    assert.equal(alive(result.childPid), false);
    const stored = await receipt(directory);
    assert.equal(stored.terminal, true);
    assert.ok(stored.outputErrors.length > 0);
  },
);
