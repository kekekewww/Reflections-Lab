import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createAgentServer } from "../../server/app.js";

async function localServer(run: (url: string) => Promise<void>): Promise<void> {
  const server = createAgentServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await run(url);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
const context = {
  scene: {
    schemaVersion: "1.0.0",
    sceneId: "scene.server-test",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects: [],
    sources: [],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  },
  materials: [{ id: "material.metal", label: "合成金屬" }],
  signals: [{ id: "signal.sine", label: "系統正弦波", frequencyHz: 440 }],
  materialRegistryRevision: 1,
};
test("local HTTP API reports unknown Meta quota and explicit offline provenance", async () =>
  localServer(async (url) => {
    const status = (await (await fetch(url + "/api/agent/status")).json()) as {
      offline: { provenance: string };
      meta: { state: string; remainingQuota: unknown };
    };
    assert.equal(status.offline.provenance, "OFFLINE_DETERMINISTIC");
    assert.equal(status.meta.state, "BLOCKED");
    assert.equal(status.meta.remainingQuota, null);
    const response = await fetch(url + "/api/agent/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "新增無重力球", context }),
    });
    const plan = (await response.json()) as { provenance: { label: string }; requests: unknown[] };
    assert.equal(response.status, 200);
    assert.equal(plan.provenance.label, "OFFLINE_DETERMINISTIC");
    assert.equal(plan.requests.length, 1);
  }));
test("cross-origin requests, model supplied billing and malformed requests cannot change host configuration", async () =>
  localServer(async (url) => {
    const foreign = await fetch(url + "/api/agent/status", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(foreign.status, 403);
    const elevated = await fetch(url + "/api/agent/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "新增球",
        context,
        maxEstimatedCostUsd: 1,
        networkEnabled: true,
      }),
    });
    assert.equal(elevated.status, 400);
    const malformed = await fetch(url + "/api/agent/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.text()).includes("stack"), false);
    const live = await fetch(url + "/api/agent/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "新增球", context, mode: "meta" }),
    });
    assert.equal(live.status, 503);
    assert.equal(
      ((await live.json()) as { error: { code: string } }).error.code,
      "PROVIDER_UNVERIFIED",
    );
  }));
