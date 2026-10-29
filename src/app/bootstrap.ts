import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { LabRuntime } from "./runtime.js";
import type { LabAction, LabController, LabViewModel } from "../ui/contracts.js";

export interface AnimationFrameHost {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}
export interface MountedReflectionLab {
  runtime: LabRuntime;
  /** Stops application ownership synchronously; renderer-native resource release may finish later. */
  dispose(): void;
}
export interface MountReflectionLabOptions {
  runtimeOptions?: Parameters<typeof LabRuntime.create>[0];
  signal?: AbortSignal;
  onError?: (error: unknown) => void;
  /** Trusted host seams allow lifecycle tests without claiming a fake DOM renders the product. */
  createRuntime?: () => Promise<LabRuntime>;
  render?: (
    element: HTMLElement,
    controller: LabController,
    onUncaughtError: (error: unknown) => void,
  ) => { unmount(): void };
  animationFrame?: AnimationFrameHost;
}
declare global {
  interface Window {
    __reflectionLabMount?: MountedReflectionLab;
  }
}

const leases = new WeakMap<HTMLElement, symbol>();
const aborted = () => new DOMException("Application mount was aborted", "AbortError");
const PANEL_PUBLICATION_MS = 100;
const coalescedInputs = new Set<LabAction["type"]>([
  "inputLook",
  "inputKey",
  "inputWheel",
  "inputPointer",
]);
type CriticalScalar = string | number | boolean | null | undefined;
function criticalPublicationState(view: LabViewModel): CriticalScalar[] {
  let pendingAssets = 0,
    failedAssets = 0;
  // Asset count is bounded by the registry budget; never inspect geometry, events or metrics.
  for (const asset of view.assets ?? []) {
    if (asset.status === "pending") pendingAssets++;
    else if (asset.status === "error") failedAssets++;
  }
  return [
    view.projectId,
    view.projectName,
    view.sceneRevision,
    view.workspace,
    view.runId,
    view.simulationState,
    view.interactionMode,
    view.alternativeInput,
    view.selectedObjectId,
    view.selectedPathId,
    view.selectedEventId,
    view.objects?.find((object) => object.held)?.id,
    view.objects?.length,
    view.assets?.length,
    pendingAssets,
    failedAssets,
    view.behaviors?.length,
    view.behaviors?.[0]?.documentRevision ?? view.lastBehaviorEdit?.afterDocumentRevision,
    view.listener?.id,
    view.listener?.attachment,
    view.placementGhost?.stage,
    view.placementGhost?.valid,
    view.placementGhost?.reason,
    view.monitor?.state,
    view.monitor?.muted,
    view.monitor?.gainLinear,
    view.monitor?.mode,
    view.monitor?.voiceLimit,
    view.monitor?.lateReverb?.enabled,
    view.monitor?.lateReverb?.decaySeconds,
    view.monitor?.lateReverb?.wetGain,
    view.recording?.state,
    view.recording?.canReplay,
    view.ai?.mode,
    view.ai?.status,
    view.ai?.message,
    view.ai?.preview,
    view.ai?.canApply,
    view.ai?.selectedProvider,
    view.ai?.providerStatus?.status,
    view.ai?.providerStatus?.reason,
    view.comparison?.hasA,
    view.comparison?.hasB,
    view.comparison?.status,
    view.acoustic?.backend,
    view.acoustic?.model,
    view.acoustic?.revision,
    // Routine worker pending/ready/stale cycles follow the panel clock; capability/error changes do not.
    view.acoustic?.state === "error" || view.acoustic?.state === "unsupported"
      ? view.acoustic.state
      : undefined,
    view.acoustic?.medium,
    view.acoustic?.temperatureC,
    view.acoustic?.speedOfSoundMps,
    view.pauseReason,
    view.notice,
    view.error,
    view.canUndo,
    view.canRedo,
  ];
}

async function defaultRenderer(): Promise<NonNullable<MountReflectionLabOptions["render"]>> {
  // Load CSS/R3F only for the real renderer; the lifecycle kernel remains Node-importable.
  const { App } = await import("../ui/App.js");
  return (element, controller, onUncaughtError) => {
    const root = createRoot(element, { onUncaughtError });
    try {
      root.render(createElement(App, { controller }));
    } catch (error) {
      try {
        root.unmount();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Application render and rollback failed");
      }
      throw error;
    }
    return root;
  };
}

/** Own one runtime, React root and application RAF for a container, including async startup. */
export async function mountReflectionLab(
  element: HTMLElement,
  options: MountReflectionLabOptions = {},
): Promise<MountedReflectionLab> {
  if (options.signal?.aborted) throw aborted();
  if (leases.has(element))
    throw new Error("Application root is already mounted or already initializing");
  const lease = Symbol("reflection-lab-mount");
  leases.set(element, lease);
  let disposed = false,
    runtime: LabRuntime | null = null,
    root: { unmount(): void } | null = null,
    raf: number | null = null;
  let mounted: MountedReflectionLab | null = null,
    runtimeOwner: LabRuntime | null = null;
  let releasePublications: (() => void) | null = null,
    flushPublications: ((now: number) => void) | null = null;
  const host =
    element.ownerDocument?.defaultView ?? (typeof window === "undefined" ? null : window);
  const debugBuild = Boolean(import.meta.env?.DEV || import.meta.env?.MODE === "e2e");
  const frameHost = options.animationFrame ?? {
    now: () => performance.now(),
    request: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
    cancel: (id: number) => cancelAnimationFrame(id),
  };
  const report = options.onError ?? ((error: unknown) => console.error(error));
  const ownsElement = () => !disposed && leases.get(element) === lease;
  const dispose = () => {
    // Clear ownership before invoking cleanup: cleanup itself may re-enter dispose.
    disposed = true;
    const oldRaf = raf,
      oldRoot = root,
      oldRuntime = runtime,
      oldPublications = releasePublications;
    raf = null;
    root = null;
    runtime = null;
    releasePublications = null;
    flushPublications = null;
    if (leases.get(element) === lease) leases.delete(element);
    options.signal?.removeEventListener("abort", onAbort);
    const failures: unknown[] = [];
    if (oldRaf !== null)
      try {
        frameHost.cancel(oldRaf);
      } catch (error) {
        failures.push(error);
      }
    if (oldPublications)
      try {
        oldPublications();
      } catch (error) {
        failures.push(error);
      }
    if (oldRoot)
      try {
        oldRoot.unmount();
      } catch (error) {
        failures.push(error);
      }
    if (oldRuntime)
      try {
        oldRuntime.dispose();
      } catch (error) {
        failures.push(error);
      }
    if (debugBuild && host) {
      if (host.__reflectionLab === runtimeOwner) delete host.__reflectionLab;
      if (host.__reflectionLabMount === mounted) delete host.__reflectionLabMount;
    }
    if (failures.length) throw new AggregateError(failures, "Application teardown failed");
  };
  const fail = (error: unknown) => {
    if (!ownsElement()) return;
    try {
      dispose();
    } catch (cleanupError) {
      report(new AggregateError([error, cleanupError], "Application failure and teardown failed"));
      return;
    }
    report(error);
  };
  function onAbort() {
    try {
      dispose();
    } catch (error) {
      report(error);
    }
  }
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const assertCurrent = () => {
    if (disposed || options.signal?.aborted || leases.get(element) !== lease) throw aborted();
  };
  try {
    const render = options.render ?? (await defaultRenderer());
    assertCurrent();
    const created = await (options.createRuntime
      ? options.createRuntime()
      : LabRuntime.create(options.runtimeOptions));
    if (disposed || options.signal?.aborted || leases.get(element) !== lease) {
      created.dispose();
      throw aborted();
    }
    runtime = created;
    runtimeOwner = created;
    let lastSnapshot: LabViewModel = created.getSnapshot();
    let pendingSnapshot: LabViewModel | null = null,
      lastCritical = criticalPublicationState(lastSnapshot),
      lastPublication = frameHost.now(),
      unsubscribeRuntime: (() => void) | null = null;
    const panelListeners = new Set<() => void>();
    const publishPanel = (now: number, snapshot = pendingSnapshot) => {
      if (!ownsElement() || !snapshot) return;
      pendingSnapshot = null;
      if (snapshot === lastSnapshot) return;
      lastSnapshot = snapshot;
      lastCritical = criticalPublicationState(snapshot);
      lastPublication = now;
      for (const listener of [...panelListeners]) {
        if (!ownsElement()) break;
        listener();
      }
    };
    const flushCommand = () => {
      if (ownsElement()) publishPanel(frameHost.now(), created.getSnapshot());
    };
    flushPublications = (now) => {
      if (now - lastPublication >= PANEL_PUBLICATION_MS) publishPanel(now);
    };
    releasePublications = () => {
      pendingSnapshot = null;
      panelListeners.clear();
      const unsubscribe = unsubscribeRuntime;
      unsubscribeRuntime = null;
      unsubscribe?.();
    };
    unsubscribeRuntime = created.subscribe(() => {
      if (!ownsElement()) return;
      const snapshot = created.getSnapshot(),
        critical = criticalPublicationState(snapshot);
      pendingSnapshot = snapshot;
      if (critical.some((value, index) => !Object.is(value, lastCritical[index])))
        publishPanel(frameHost.now(), snapshot);
    });
    // R3F has an independent reconciler. Its late callbacks cannot reach a freed engine.
    const controller: LabController = {
      getSnapshot: () => lastSnapshot,
      subscribe: (listener) => {
        if (disposed) return () => {};
        panelListeners.add(listener);
        return () => {
          panelListeners.delete(listener);
        };
      },
      dispatch: (action) => {
        if (disposed) return;
        let result: void | Promise<void>;
        try {
          result = created.dispatch(action);
        } catch (error) {
          flushCommand();
          throw error;
        }
        if (coalescedInputs.has(action.type)) return result;
        flushCommand();
        if (result) return result.finally(flushCommand);
      },
      getPose: (objectId) => (disposed ? undefined : created.getPose(objectId)),
      getFPSCamera: () => (disposed ? undefined : created.getFPSCamera()),
    };
    root = render(element, controller, (error) => {
      if (!ownsElement()) return;
      // React reports commit errors while its renderer can still be on the stack.
      queueMicrotask(() => {
        if (ownsElement()) fail(error);
      });
    });
    assertCurrent();
    let last = frameHost.now();
    const frame = (now: number) => {
      if (disposed) return;
      raf = null;
      try {
        created.advance(Math.max(0, (now - last) / 1000));
        last = now;
        flushPublications?.(now);
        if (!disposed) raf = frameHost.request(frame);
      } catch (error) {
        fail(error);
      }
    };
    raf = frameHost.request(frame);
    assertCurrent();
    mounted = { runtime: created, dispose };
    if (debugBuild && host) {
      host.__reflectionLab = created;
      host.__reflectionLabMount = mounted;
    }
    return mounted;
  } catch (error) {
    try {
      dispose();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Application startup and teardown failed");
    }
    throw error;
  }
}
