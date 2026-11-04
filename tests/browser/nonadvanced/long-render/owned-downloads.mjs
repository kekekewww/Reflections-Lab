import path from "node:path";

/** Only the exact page and downloads supplied by this runner are owned here. */
export class OwnedDownloadBatch {
  constructor(page, directory, onSaved, options = {}) {
    this.page = page;
    this.directory = directory;
    this.onSaved = onSaved;
    this.saveDownload =
      options.save ??
      ((download, filename) => download.saveAs(path.join(this.directory, filename)));
    this.cancelled = false;
    this.task = null;
    this.pendingEvents = new Set();
    this.received = new Set();
    this.cancellations = new Map();
  }
  run(ids) {
    this.task ??= this.perform(ids);
    // A coordinator deadline can stop awaiting this task before the browser closes.
    void this.task.catch(() => undefined);
    return this.task;
  }
  assertActive() {
    if (this.cancelled) throw new Error("OWNED_DOWNLOAD_BATCH_CANCELLED");
  }
  async perform(ids) {
    for (const id of ids) {
      this.assertActive();
      const pending = this.page.waitForEvent("download", { timeout: 30000 });
      this.pendingEvents.add(pending);
      // Install this before evaluate: evaluate may reject before we await the event.
      void pending.catch(() => undefined);
      void pending.then(
        (download) => {
          this.pendingEvents.delete(pending);
          this.received.add(download);
          if (this.cancelled) this.cancelOne(download);
        },
        () => this.pendingEvents.delete(pending),
      );
      await this.page.evaluate((outputId) => window.nativeLongDownload(outputId), id);
      this.assertActive();
      const download = await pending;
      try {
        this.assertActive();
        const filename = download.suggestedFilename();
        const transport = await this.saveDownload(download, filename, id);
        this.assertActive();
        this.onSaved({ id, filename, ...(transport ? { transport } : {}) });
      } finally {
        this.received.delete(download);
      }
    }
  }
  cancelOne(download) {
    if (!this.cancellations.has(download)) {
      const cancelled = Promise.resolve().then(() => download.cancel());
      void cancelled.catch(() => undefined);
      this.cancellations.set(download, cancelled);
    }
    return this.cancellations.get(download);
  }
  cancel() {
    this.cancelled = true;
    return Promise.allSettled([...this.received].map((download) => this.cancelOne(download)));
  }
  async settle() {
    // First settle all event callbacks: a late event can create a new cancelOne.
    const work = await Promise.allSettled([
      ...(this.task ? [this.task] : []),
      ...this.pendingEvents,
    ]);
    // The caller closes its owned page/browser before this bounded await. With
    // task/events settled, no later event can add an unobserved cancellation.
    const cancellations = await Promise.allSettled([...this.cancellations.values()]);
    return { work, cancellations };
  }
}
