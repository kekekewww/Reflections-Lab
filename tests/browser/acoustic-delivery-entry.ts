import { AcousticService } from "../../src/app/acoustic-service.js";

/** This test-only entry is bundled separately from the product; no Vite/HMR client is loaded. */
const createWorker = (): Worker =>
  new Worker(new URL("../../src/app/acoustic-worker.ts", import.meta.url), { type: "module" });
Object.assign(window, { acousticDeliveryHarness: { AcousticService, createWorker } });
