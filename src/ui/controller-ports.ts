import type { LabAction, LabController } from "./contracts.js";

/** Preserve optional composition ports when the shell wraps dispatch errors. */
export function createSafeController(
  controller: LabController,
  onError: (message: string) => void,
): LabController {
  return {
    getSnapshot: controller.getSnapshot.bind(controller),
    subscribe: controller.subscribe.bind(controller),
    getPose: controller.getPose.bind(controller),
    ...(controller.getFPSCamera ? { getFPSCamera: controller.getFPSCamera.bind(controller) } : {}),
    ...(controller.getRenderHost
      ? { getRenderHost: controller.getRenderHost.bind(controller) }
      : {}),
    ...(controller.getMotionWorkspace
      ? { getMotionWorkspace: controller.getMotionWorkspace.bind(controller) }
      : {}),
    ...(controller.getAgentSession
      ? { getAgentSession: controller.getAgentSession.bind(controller) }
      : {}),
    ...(controller.getAudioDiagnostics
      ? { getAudioDiagnostics: controller.getAudioDiagnostics.bind(controller) }
      : {}),
    ...(controller.captureShortTake
      ? { captureShortTake: controller.captureShortTake.bind(controller) }
      : {}),
    ...(controller.listRecordingRecovery
      ? { listRecordingRecovery: controller.listRecordingRecovery.bind(controller) }
      : {}),
    ...(controller.recoverRecording
      ? { recoverRecording: controller.recoverRecording.bind(controller) }
      : {}),
    ...(controller.discardRecordingRecovery
      ? { discardRecordingRecovery: controller.discardRecordingRecovery.bind(controller) }
      : {}),
    ...(controller.readLiveMonitor
      ? { readLiveMonitor: controller.readLiveMonitor.bind(controller) }
      : {}),
    ...(controller.releaseLiveMonitor
      ? { releaseLiveMonitor: controller.releaseLiveMonitor.bind(controller) }
      : {}),
    dispatch: (action: LabAction) => {
      try {
        return Promise.resolve(controller.dispatch(action)).catch((error: unknown) => {
          onError(error instanceof Error ? error.message : String(error));
        });
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
        return Promise.resolve();
      }
    },
  };
}
