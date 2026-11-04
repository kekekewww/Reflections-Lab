export const TOP_MONITOR_MAX_HZ = 15;
const SAMPLE_INTERVAL_MS = 1000 / TOP_MONITOR_MAX_HZ;
type FrameCallback = (timeMs: number) => void;

export interface TopMonitorLoopOptions {
  requestFrame(callback: FrameCallback): number;
  cancelFrame(handle: number): void;
  /** Adjacent display RAF spacing, not the throttled sample period or CPU usage. */
  sample(frameIntervalMs: number | null): void;
  release(): void;
  onError(error: unknown): void;
  isVisible?: () => boolean;
}
export interface TopMonitorLoop {
  stop(): void;
  setVisible(visible: boolean): void;
}

/** One pending RAF and one reusable callback per visibility epoch. No audio clocks are advanced. */
export function startTopMonitorLoop(options: TopMonitorLoopOptions): TopMonitorLoop {
  let stopped = false;
  let active = false;
  let epoch = 0;
  let pendingHandle: number | null = null;
  let previousFrameMs: number | null = null;
  let lastSampleMs: number | null = null;
  let reportedError = false;

  function report(error: unknown): void {
    if (reportedError) return;
    reportedError = true;
    try {
      options.onError(error);
    } catch {
      // A view's error reporter must not turn a handled sampling failure into a RAF exception.
    }
  }
  function deactivate(): unknown[] {
    const handle = pendingHandle;
    const release = active;
    epoch++;
    pendingHandle = null;
    active = false;
    previousFrameMs = null;
    lastSampleMs = null;
    const errors: unknown[] = [];
    if (handle !== null) {
      try {
        options.cancelFrame(handle);
      } catch (error) {
        errors.push(error);
      }
    }
    if (release) {
      try {
        options.release();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }
  function fail(error: unknown): void {
    const wasStopped = stopped;
    stopped = true;
    const cleanupErrors = wasStopped ? [] : deactivate();
    report(
      cleanupErrors.length
        ? new AggregateError([error, ...cleanupErrors], "Monitor sampling and cleanup failed")
        : error,
    );
  }
  function stop(): void {
    if (stopped) return;
    stopped = true;
    const errors = deactivate();
    if (errors.length) report(new AggregateError(errors, "Monitor cleanup failed"));
  }
  function setVisible(visible: boolean): void {
    if (stopped) return;
    if (!visible) {
      if (active) {
        const errors = deactivate();
        if (errors.length) {
          stopped = true;
          report(new AggregateError(errors, "Monitor cleanup failed"));
        }
      }
      return;
    }
    if (active) return;
    try {
      if (options.isVisible && !options.isVisible()) return;
      active = true;
      const ownEpoch = ++epoch;
      const frame: FrameCallback = (timeMs) => {
        if (stopped || !active || ownEpoch !== epoch) return;
        pendingHandle = null;
        try {
          if (options.isVisible && !options.isVisible()) {
            setVisible(false);
            return;
          }
          if (
            !Number.isFinite(timeMs) ||
            timeMs < 0 ||
            (previousFrameMs !== null && timeMs < previousFrameMs)
          )
            throw new RangeError("Monitor RAF timestamps must be finite and monotonic");
          const interval = previousFrameMs === null ? null : timeMs - previousFrameMs;
          previousFrameMs = timeMs;
          if (lastSampleMs === null || timeMs - lastSampleMs >= SAMPLE_INTERVAL_MS) {
            lastSampleMs = timeMs;
            options.sample(interval);
          }
          if (!stopped && active && ownEpoch === epoch) pendingHandle = options.requestFrame(frame);
        } catch (error) {
          fail(error);
        }
      };
      pendingHandle = options.requestFrame(frame);
    } catch (error) {
      fail(error);
    }
  }
  setVisible(true);
  return { stop, setVisible };
}
