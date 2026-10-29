import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { atomic, json, readState, saveState, sha } from "../../scripts/agents/store.mjs";

const fixtures = path.resolve(".cache/agent-store-atomic-tests");
const nativeRename = fs.renameSync;
const nativeWrite = fs.writeFileSync;

function fixture() {
  fs.mkdirSync(fixtures, { recursive: true });
  const directory = fs.mkdtempSync(path.join(fixtures, "case-"));
  const target = path.join(directory, "state.json");
  const original = json({ revision: 1, status: "PENDING" });
  fs.writeFileSync(target, original);
  return { directory, target, original };
}

// Only the OS fault boundary and synchronous waiting are injected. The temp
// creation, target reads, successful rename and integrity checks use real files.
function withRenameFault(t, { platform = "win32", rename }, body) {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const waits = [];
  const writes = [];
  Object.defineProperty(process, "platform", { ...descriptor, value: platform });
  t.mock.method(fs, "renameSync", rename);
  t.mock.method(fs, "writeFileSync", (...args) => {
    writes.push(args[0]);
    return nativeWrite(...args);
  });
  t.mock.method(Atomics, "wait", (_array, _index, _value, duration) => {
    waits.push(duration);
    return "timed-out";
  });
  syncBuiltinESMExports();
  try {
    return body({ waits, writes });
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    Object.defineProperty(process, "platform", descriptor);
  }
}

test("Windows EPERM retries publish the same intact temp while readers retain the old target", (t) => {
  const { directory, target, original } = fixture();
  const replacement = { revision: 2, status: "RUNNING_MUSE" };
  const attemptedTemps = [];
  withRenameFault(
    t,
    {
      rename(temp, destination) {
        attemptedTemps.push(temp);
        assert.equal(destination, target);
        assert.equal(fs.readFileSync(target, "utf8"), original);
        assert.equal(fs.readFileSync(temp, "utf8"), json(replacement));
        if (attemptedTemps.length < 3)
          throw Object.assign(new Error("transient sharing denial"), { code: "EPERM" });
        return nativeRename(temp, destination);
      },
    },
    ({ waits, writes }) => {
      atomic(target, replacement);
      assert.equal(attemptedTemps.length, 3);
      assert.equal(new Set(attemptedTemps).size, 1);
      assert.deepEqual(writes, [attemptedTemps[0]], "the unique temp must be written only once");
      assert.ok(waits.length === 2 && waits.every((duration) => duration > 0));
      assert.equal(fs.readFileSync(target, "utf8"), json(replacement));
      assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
    },
  );
});

test("permanent Windows EPERM has finite backoff and preserves the first error, old target and temp", (t) => {
  const { directory, target, original } = fixture();
  const replacement = { revision: 2, status: "RUNNING_MUSE" };
  const errors = [];
  const attemptedTemps = [];
  withRenameFault(
    t,
    {
      rename(temp, destination) {
        attemptedTemps.push(temp);
        assert.equal(destination, target);
        assert.equal(fs.readFileSync(target, "utf8"), original);
        assert.equal(fs.readFileSync(temp, "utf8"), json(replacement));
        const error = Object.assign(new Error(`sharing denial ${errors.length + 1}`), {
          code: "EPERM",
        });
        errors.push(error);
        throw error;
      },
    },
    ({ waits, writes }) => {
      assert.throws(
        () => atomic(target, replacement),
        (error) => error === errors[0],
      );
      assert.equal(errors.length, 6, "publication must stop after the finite retry budget");
      assert.deepEqual(waits, [5, 10, 20, 40, 80]);
      assert.ok(waits.reduce((sum, duration) => sum + duration, 0) <= 250);
      assert.equal(new Set(attemptedTemps).size, 1);
      assert.deepEqual(writes, [attemptedTemps[0]]);
      assert.equal(fs.readFileSync(target, "utf8"), original);
      assert.equal(fs.readFileSync(attemptedTemps[0], "utf8"), json(replacement));
      assert.equal(
        fs.readdirSync(directory).length,
        2,
        "keep temp evidence instead of deleting either file",
      );
    },
  );
});

test("non-EPERM Windows errors fail immediately without broad permission retries", (t) => {
  for (const code of ["EACCES", "EBUSY", "ENOENT"]) {
    const { target, original } = fixture();
    const fault = Object.assign(new Error(`permanent ${code}`), { code });
    let calls = 0;
    withRenameFault(
      t,
      {
        rename() {
          calls++;
          throw fault;
        },
      },
      ({ waits }) => {
        assert.throws(
          () => atomic(target, { revision: 2 }),
          (error) => error === fault,
        );
        assert.equal(calls, 1);
        assert.deepEqual(waits, []);
        assert.equal(fs.readFileSync(target, "utf8"), original);
      },
    );
  }
});

test("a nontransient error after Windows EPERM propagates immediately", (t) => {
  const { target, original } = fixture();
  const permanent = Object.assign(new Error("permission remains denied"), { code: "EACCES" });
  let calls = 0;
  withRenameFault(
    t,
    {
      rename() {
        if (++calls === 1)
          throw Object.assign(new Error("temporary sharing denial"), { code: "EPERM" });
        throw permanent;
      },
    },
    ({ waits }) => {
      assert.throws(
        () => atomic(target, { revision: 2 }),
        (error) => error === permanent,
      );
      assert.equal(calls, 2);
      assert.deepEqual(waits, [5]);
      assert.equal(fs.readFileSync(target, "utf8"), original);
    },
  );
});

test("EPERM on other platforms fails immediately with no Windows backoff", (t) => {
  for (const platform of ["linux", "darwin"]) {
    const { target, original } = fixture();
    const fault = Object.assign(new Error("not a Windows sharing denial"), { code: "EPERM" });
    let calls = 0;
    withRenameFault(
      t,
      {
        platform,
        rename() {
          calls++;
          throw fault;
        },
      },
      ({ waits }) => {
        assert.throws(
          () => atomic(target, { revision: 2 }),
          (error) => error === fault,
        );
        assert.equal(calls, 1);
        assert.deepEqual(waits, []);
        assert.equal(fs.readFileSync(target, "utf8"), original);
      },
    );
  }
});

function stateFixture() {
  const { directory } = fixture();
  const control = path.join(directory, "control");
  fs.mkdirSync(control);
  const state = {
    run_id: randomUUID(),
    task_id: "ATOMIC-FAULT-INJECTION",
    status: "PENDING",
    validation_mode: "MOCK",
    contract: { objective: "No subprocess or model request" },
  };
  state.contract_sha256 = sha(json(state.contract));
  saveState(control, state, "run-created");
  const run = path.join(control, "runs", state.run_id);
  return { control, state, run, target: path.join(run, "state.json") };
}

test("saveState transient EPERM publishes one revision with a valid event hash", (t) => {
  const { control, state, run, target } = stateFixture();
  const oldBytes = fs.readFileSync(target, "utf8");
  const oldRevision = state.revision;
  const oldEvent = state.last_event;
  state.status = "RUNNING_MUSE";
  let calls = 0;
  withRenameFault(
    t,
    {
      rename(temp, destination) {
        assert.equal(destination, target);
        assert.equal(fs.readFileSync(target, "utf8"), oldBytes);
        assert.equal(state.revision, oldRevision);
        assert.equal(state.last_event, oldEvent);
        if (++calls === 1)
          throw Object.assign(new Error("transient state sharing denial"), { code: "EPERM" });
        return nativeRename(temp, destination);
      },
    },
    () => saveState(control, state, "implementation-started"),
  );
  assert.equal(state.revision, oldRevision + 1);
  assert.deepEqual(readState(control, state.run_id), state);
  assert.equal(fs.readdirSync(path.join(run, "events")).length, 2);
});

test("exhausted saveState publication retains prior revision and all orphan evidence without claiming success", (t) => {
  const { control, state, run, target } = stateFixture();
  const oldBytes = fs.readFileSync(target, "utf8");
  const oldRevision = state.revision;
  const oldEvent = state.last_event;
  state.status = "RUNNING_MUSE";
  const beforeCall = structuredClone(state);
  const fault = Object.assign(new Error("permanent state sharing denial"), { code: "EPERM" });
  let calls = 0;
  withRenameFault(
    t,
    {
      rename() {
        calls++;
        throw fault;
      },
    },
    () => {
      assert.throws(
        () => saveState(control, state, "implementation-started"),
        (error) => error === fault,
      );
      assert.equal(calls, 6);
    },
  );
  assert.deepEqual(
    state,
    beforeCall,
    "saveState must not advance the caller's revision or last_event",
  );
  assert.equal(state.revision, oldRevision);
  assert.equal(state.last_event, oldEvent);
  assert.equal(fs.readFileSync(target, "utf8"), oldBytes);
  assert.equal(readState(control, state.run_id).revision, oldRevision);
  const events = fs
    .readdirSync(path.join(run, "events"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(run, "events", name), "utf8")));
  const orphan = events.find((event) => event.id !== oldEvent);
  assert.equal(orphan.type, "implementation-started");
  assert.equal(orphan.sequence, oldRevision + 1);
  const temps = fs.readdirSync(run).filter((name) => name.endsWith(".tmp"));
  assert.equal(temps.length, 1);
  const unpublished = JSON.parse(fs.readFileSync(path.join(run, temps[0]), "utf8"));
  assert.equal(unpublished.last_event, orphan.id);
  assert.equal(sha(json(unpublished)), orphan.state_sha256);
  // Existing event-before-state ordering is deliberately not rewritten here:
  // callers must not infer success or a repaired event chain after exhaustion.
});
