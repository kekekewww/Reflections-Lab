/** Test-runner boundary: a source snapshot is meaningful only for its live owned server generation. */
export function assertOwnedRecordingServer(expectedNonce, receivedNonce, child) {
  if (
    typeof expectedNonce !== "string" ||
    expectedNonce.length < 16 ||
    receivedNonce !== expectedNonce ||
    !Number.isSafeInteger(child.pid) ||
    child.pid < 1 ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    throw Object.assign(
      new Error("Recording fixture server identity is not this live owned generation"),
      { code: "RECORDING_SERVER_IDENTITY" },
    );
}
