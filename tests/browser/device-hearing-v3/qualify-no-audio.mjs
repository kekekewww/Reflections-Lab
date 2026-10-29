import http from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { computeClosure } from "./review-gate.mjs";
import { launchManualProbeDriver } from "./manual-probe-driver.mjs";
const base = path.resolve("artifacts/v1/device-hearing-v3-frozen-20261029-r6/bundle");
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method !== "GET" || url.search || url.pathname.includes(".."))
      throw Error("bad request");
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const bytes = await readFile(path.join(base, name));
    res.writeHead(200);
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
let session;
try {
  const port = server.address().port;
  const qualificationReceipt = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      status: "MOCK_NOT_APPROVED",
      reviewer: "qualification-fixture",
      executable: {
        path: chromium.executablePath(),
        sha256: createHash("sha256")
          .update(await readFile(chromium.executablePath()))
          .digest("hex"),
      },
      files: await computeClosure(process.cwd()),
    }),
  );
  session = await launchManualProbeDriver({
    qualificationReceipt,
    go: true,
    baseUrl: `http://127.0.0.1:${port}/`,
    previewPid: process.pid,
    browserExecutable: chromium.executablePath(),
    qualificationNoAudio: true,
  });
  if (
    session.record.qualificationNoAudio.audioContextAttempts !== 0 ||
    session.record.served.length !== 14
  )
    throw Error("qualification failed");
  let blocked = false;
  try {
    await session.command({ command: "arm" });
  } catch {
    blocked = true;
  }
  if (!blocked) throw Error("arm was not blocked");
  const done = await session.command({ command: "finish", browser: "close" });
  if (!done.ok) throw Error("cleanup failed");
  console.log(
    JSON.stringify({
      ok: true,
      ...session.record.qualificationNoAudio,
      commandArmBlocked: blocked,
      browserCleanup: session.record.browserCleanup,
      hearing: session.record.hearing,
      directory: session.directory,
    }),
  );
} finally {
  if (session && !session.record.browserCleanup)
    await session.command({ command: "finish", browser: "close" }).catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}
