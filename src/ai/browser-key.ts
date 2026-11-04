import { AgentError } from "./types.js";

/**
 * The visitor's own Meta key on the hosted site. It lives only in this variable: never in
 * storage, a URL, the Scene, React state or a log, so reloading the page is enough to lose it.
 */
let key: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function setBrowserKey(value: string): void {
  const trimmed = value.trim();
  // A key travels in an HTTP header, so anything but printable ASCII is a paste mistake.
  if (!trimmed || trimmed.length > 1024 || /[^\x21-\x7e]/.test(trimmed))
    throw new AgentError("KEY_INVALID", "Meta API key格式無效。");
  key = trimmed;
  notify();
}

export function forgetBrowserKey(): void {
  if (key === null) return;
  key = null;
  notify();
}

export function getBrowserKey(): string | null {
  return key;
}

export function hasBrowserKey(): boolean {
  return key !== null;
}

export function subscribeBrowserKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
