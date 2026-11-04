import { canonicalStringify, sha256Canonical } from "../experiments/hash.js";
import type { RecordingArtifact } from "../experiments/types.js";
import { IndexedDBRenderOutputStore } from "../audio/render-output-store.js";
import { NativeOfflineRenderBackend } from "../audio/render-backend.js";
import { createRenderPreset } from "../audio/render-preset.js";
import type { RenderPresetOptions } from "../audio/render-preset.js";
import { RenderError } from "../audio/render-pcm.js";
import type { RenderResult } from "../audio/render-contract.js";
import type { AudioAssetBankEntry } from "../audio/types.js";
import type { RenderMasterSettings } from "../audio/render-types.js";

export interface RenderHostSnapshot {
  state: "idle" | "rendering" | "completed" | "failed" | "cancelled";
  recordingAvailable: boolean;
  recordingId: string | null;
  jobId: string | null;
  completedOutputs: number;
  totalOutputs: number;
  error: string | null;
  downloadingOutputId: string | null;
  outputs: {
    id: string;
    filename: string;
    bytes: number;
    peakLinear: number;
    tailTruncated: boolean;
    historyIncomplete: boolean;
  }[];
}
export interface RenderHostOptions {
  getRecording(): RecordingArtifact | null;
  getAssetBank?(): readonly AudioAssetBankEntry[];
  /** Preferred production source: pins decoded assets until this render settles. */
  acquireAssetBank?(): Promise<{
    readonly entries: readonly AudioAssetBankEntry[];
    release(): void;
  }>;
  getMasterSettings?(): RenderMasterSettings;
  /** Optional injection for host tests; production uses a real OfflineAudioContext. */
  preparePreset?: typeof createRenderPreset;
  createContext?: (channels: number, frames: number, sampleRate: number) => OfflineAudioContext;
}

/** UI-owned render service. Downloads are available only after atomic publication. */
export class RenderHost {
  private listeners = new Set<() => void>();
  private backend: NativeOfflineRenderBackend | null = null;
  private published: { backend: NativeOfflineRenderBackend; jobId: string } | null = null;
  private disposed = false;
  private operation: { cancelled: boolean } | null = null;
  private downloadSerial = 0;
  private recoveringArchive = false;
  private readonly archiveStore = new IndexedDBRenderOutputStore();
  private snapshot: RenderHostSnapshot = {
    state: "idle",
    recordingAvailable: false,
    recordingId: null,
    jobId: null,
    completedOutputs: 0,
    totalOutputs: 0,
    error: null,
    downloadingOutputId: null,
    outputs: [],
  };
  constructor(private readonly options: RenderHostOptions) {
    this.refresh();
  }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): RenderHostSnapshot => this.snapshot;
  refresh = (): void => {
    if (this.disposed) return;
    const recording = this.options.getRecording();
    const available = Boolean(
      recording && recording.status === "captured" && recording.frameCount > 0,
    );
    const id = available ? recording!.runId : null;
    if (available !== this.snapshot.recordingAvailable || id !== this.snapshot.recordingId)
      this.publish({ recordingAvailable: available, recordingId: id });
  };
  async renderPreset(options: RenderPresetOptions = {}): Promise<RenderResult> {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    if (this.snapshot.state === "rendering" || this.recoveringArchive)
      throw new RenderError("RENDER_BUSY", "A render or archive recovery is already in progress.");
    const recording = this.options.getRecording();
    if (!recording)
      throw new RenderError(
        "RENDER_RECORDING_MISSING",
        "Capture a complete take before rendering.",
      );
    this.downloadSerial++;
    const operation = { cancelled: false };
    this.operation = operation;
    const jobId = `render-${globalThis.crypto.randomUUID()}`;
    this.publish({
      state: "rendering",
      completedOutputs: 0,
      totalOutputs: 0,
      error: null,
      downloadingOutputId: null,
      jobId,
    });
    let assetLease: { readonly entries: readonly AudioAssetBankEntry[]; release(): void } | null =
      null;
    try {
      if (this.options.acquireAssetBank) assetLease = await this.options.acquireAssetBank();
      if (this.disposed)
        throw new RenderError(
          "RENDER_DISPOSED",
          "Render host was disposed during asset preparation.",
        );
      const { job, input } = await (this.options.preparePreset ?? createRenderPreset)(
        recording,
        assetLease?.entries ?? this.options.getAssetBank?.() ?? [],
        options,
        this.options.getMasterSettings?.(),
        jobId,
      );
      if (this.disposed)
        throw new RenderError("RENDER_DISPOSED", "Render host was disposed during preparation.");
      if (operation.cancelled) {
        const result = {
          status: "cancelled" as const,
          jobId,
          jobSha256: await sha256Canonical(job),
          code: "RENDER_CANCELLED",
          reason: "Render cancelled during preparation.",
          limitations: [],
        };
        this.publish({ state: "cancelled", error: null });
        return result;
      }
      this.publish({ jobId: job.jobId, totalOutputs: job.outputs.length });
      const backend = new NativeOfflineRenderBackend({
        input,
        onProgress: (completedOutputs, totalOutputs) =>
          this.publish({ completedOutputs, totalOutputs }),
        ...(this.options.createContext ? { createContext: this.options.createContext } : {}),
      });
      this.backend = backend;
      const result = await backend.render(job);
      if (operation.cancelled && result.status === "completed") {
        this.backend = null;
        await backend.discardOwnedJob(job.jobId);
        backend.dispose();
        this.publish({ state: "cancelled", error: null });
        return {
          status: "cancelled",
          jobId,
          jobSha256: result.jobSha256,
          code: "RENDER_CANCELLED",
          reason: "Render cancelled before host publication.",
          limitations: result.provenance.limitations,
        };
      }
      if (result.status === "completed") {
        const manifest = backend.getManifest(job.jobId)!;
        const previous = this.published;
        this.published = { backend, jobId: job.jobId };
        if (previous && previous.backend !== backend) previous.backend.dispose();
        this.publish({
          state: "completed",
          outputs: manifest.files.map((file) => {
            const output = result.outputs.find((value) => value.requestId === file.id)!;
            return {
              ...file,
              peakLinear: output.peakLinear,
              tailTruncated: output.tailTruncated,
              historyIncomplete: output.historyIncomplete,
            };
          }),
        });
      } else {
        backend.dispose();
        if (this.backend === backend) this.backend = null;
        this.publish({ state: result.status, error: `${result.code}: ${result.reason}` });
      }
      return result;
    } catch (error) {
      this.publish({
        state: operation.cancelled ? "cancelled" : "failed",
        error: operation.cancelled ? null : error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      assetLease?.release();
      if (this.operation === operation) this.operation = null;
    }
  }
  async cancel(): Promise<void> {
    if (this.snapshot.state !== "rendering") return;
    if (this.operation) this.operation.cancelled = true;
    const jobId = this.snapshot.jobId;
    if (jobId && this.backend) await this.backend.cancel(jobId);
  }
  download(outputId: string): void {
    if (!this.published || this.disposed)
      throw new RenderError("RENDER_NOT_COMPLETED", "Render all outputs before downloading.");
    if (
      !this.published.backend
        .getManifest(this.published.jobId)
        ?.files.some((file) => file.id === outputId)
    )
      throw new RenderError(
        "RENDER_OUTPUT_MISSING",
        "The requested completed output is unavailable.",
      );
    const published = this.published;
    const pending = this.downloadAsync(outputId);
    const serial = this.downloadSerial;
    void pending.catch((error: unknown) => {
      if (!this.disposed && this.published === published && serial === this.downloadSerial)
        this.publish({ error: error instanceof Error ? error.message : String(error) });
    });
  }
  async downloadAsync(outputId: string): Promise<void> {
    const published = this.published;
    if (!published || this.disposed)
      throw new RenderError("RENDER_NOT_COMPLETED", "Render all outputs before downloading.");
    const file = published.backend
      .getManifest(published.jobId)
      ?.files.find((value) => value.id === outputId);
    if (!file)
      throw new RenderError(
        "RENDER_OUTPUT_MISSING",
        "The requested completed output is unavailable.",
      );
    const serial = ++this.downloadSerial;
    this.publish({ downloadingOutputId: outputId, error: null });
    try {
      const blob = await published.backend.getFileBlob(published.jobId, outputId);
      if (this.disposed || this.published !== published || this.downloadSerial !== serial) return;
      if (!blob)
        throw new RenderError(
          "RENDER_OUTPUT_MISSING",
          "The requested completed output is unavailable.",
        );
      this.downloadBlob(blob, file.filename);
    } finally {
      if (this.downloadSerial === serial) this.publish({ downloadingOutputId: null });
    }
  }
  /** Durable outputs from this origin survive host disposal/reload until explicitly deleted. */
  async listArchive() {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    return this.archiveStore.listJobs();
  }
  async getArchiveUsage() {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    return this.archiveStore.getArchiveUsage();
  }
  async recoverArchive() {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    if (this.snapshot.state === "rendering" || this.recoveringArchive)
      throw new RenderError("RENDER_BUSY", "Finish the current render or archive recovery first.");
    this.recoveringArchive = true;
    try {
      return await this.archiveStore.recover();
    } finally {
      this.recoveringArchive = false;
    }
  }
  async deleteArchivedJob(jobId: string): Promise<void> {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    if (this.snapshot.state === "rendering" && this.snapshot.jobId === jobId)
      throw new RenderError(
        "RENDER_BUSY",
        "The active render cannot be deleted as a completed output.",
      );
    await this.archiveStore.deletePublishedJob(jobId);
    if (this.published?.jobId === jobId) {
      this.published.backend.dispose();
      this.published = null;
      this.downloadSerial++;
      this.publish({ outputs: [], downloadingOutputId: null });
    }
  }
  async discardInterruptedJob(jobId: string): Promise<void> {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    const stored = (await this.archiveStore.listJobs()).find((job) => job.jobId === jobId);
    if (!stored?.canDiscard)
      throw new RenderError(
        "RENDER_STORE_STATE",
        "Only an interrupted output without an active writer can be discarded here.",
      );
    await this.archiveStore.discard(jobId);
  }
  async downloadArchivedOutput(jobId: string, outputId: string): Promise<void> {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    const serial = ++this.downloadSerial;
    this.publish({ downloadingOutputId: `${jobId}:${outputId}`, error: null });
    try {
      const blob = await this.archiveStore.readBlob(jobId, outputId);
      if (this.disposed || serial !== this.downloadSerial) return;
      if (!blob)
        throw new RenderError("RENDER_OUTPUT_MISSING", "The archived output is unavailable.");
      this.downloadBlob(blob, `${jobId}-${outputId}.wav`);
    } finally {
      if (serial === this.downloadSerial) this.publish({ downloadingOutputId: null });
    }
  }
  async downloadArchivedManifest(jobId: string): Promise<void> {
    if (this.disposed) throw new RenderError("RENDER_DISPOSED", "Render host has been disposed.");
    const serial = ++this.downloadSerial;
    this.publish({ downloadingOutputId: `${jobId}:manifest`, error: null });
    try {
      const manifest = await this.archiveStore.readManifest(jobId);
      if (this.disposed || serial !== this.downloadSerial) return;
      if (!manifest)
        throw new RenderError("RENDER_OUTPUT_MISSING", "The archived manifest is unavailable.");
      this.downloadBlob(
        new Blob([manifest], { type: "application/json" }),
        `${jobId}.manifest.json`,
      );
    } finally {
      if (serial === this.downloadSerial) this.publish({ downloadingOutputId: null });
    }
  }
  downloadManifest(): void {
    const manifest = this.published?.backend.getManifest(this.published.jobId);
    if (!manifest || this.disposed)
      throw new RenderError("RENDER_NOT_COMPLETED", "The completed manifest is unavailable.");
    this.downloadBlob(
      new Blob([canonicalStringify(manifest)], { type: "application/json" }),
      `${manifest.job.jobId}.manifest.json`,
    );
  }
  dispose(): void {
    this.disposed = true;
    this.downloadSerial++;
    if (this.operation) this.operation.cancelled = true;
    if (this.snapshot.jobId) void this.backend?.cancel(this.snapshot.jobId);
    this.backend?.dispose();
    if (this.published?.backend !== this.backend) this.published?.backend.dispose();
    this.published = null;
    this.archiveStore.dispose();
    this.listeners.clear();
  }
  private publish(patch: Partial<RenderHostSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
