import { AgentError } from "../src/ai/types.js";

/** Own bytes before the next pull; injected streams may reuse their backing buffer. */
export async function readBoundedMetaResponseText(response: Response): Promise<string> {
  if (!response.body) throw new AgentError("PROVIDER_REQUEST_FAILED", "Meta回覆沒有body。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let completed = false;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) {
        completed = true;
        break;
      }
      bytes += part.value.byteLength;
      if (bytes > 256 * 1024) throw new AgentError("INPUT_LIMIT", "Meta回覆超出大小上限。");
      chunks.push(new Uint8Array(part.value));
    }
  } finally {
    // Never wait for an unread tee branch while cancelling a bounded response.
    if (!completed) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    throw new AgentError("PROVIDER_REQUEST_FAILED", "Meta回覆不是有效UTF-8，未接受內容。");
  }
}

/** Inspection preserves an independent response for the provider consumer. */
export async function inspectBoundedMetaResponse(
  response: Response,
): Promise<{ text: string; response: Response }> {
  // Read the original exactly once. Draining a tee before its other consumer can
  // leave that branch holding producer-owned/reused chunks before it starts.
  const text = await readBoundedMetaResponseText(response);
  return {
    text,
    response: new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  };
}
