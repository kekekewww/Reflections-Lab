import { sealRecordingSnapshot, type RecordingSealSnapshot } from "./recorder.js";
self.onmessage = (event: MessageEvent<{ id: string; input: RecordingSealSnapshot }>) => {
  const { id, input } = event.data;
  void sealRecordingSnapshot(input)
    .then(({ artifact, bytes, encodedSha256 }) => {
      self.postMessage(
        { id, ok: true, bytes, encodedSha256, artifactSha256: artifact.artifactSha256 },
        { transfer: [bytes] },
      );
    })
    .catch((error: unknown) => {
      const value = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
      self.postMessage({
        id,
        ok: false,
        error: {
          name: typeof value.name === "string" ? value.name.slice(0, 80) : "Error",
          code: typeof value.code === "string" ? value.code.slice(0, 80) : "",
          message:
            typeof value.message === "string" ? value.message.slice(0, 512) : "WORKER_FAILURE",
        },
      });
    });
};
