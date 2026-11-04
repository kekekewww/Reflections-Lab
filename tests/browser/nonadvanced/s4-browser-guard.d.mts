import type { Browser, BrowserContext } from "@playwright/test";
export interface S4BrowserGuard {
  registerContext(context: BrowserContext): Promise<void>;
  flush(): Promise<void>;
}
export function shouldBlockS4Request(address: string, method?: string): boolean;
export function guardBrowser(
  browser: Browser,
  options?: { outputDirectory?: string },
): Promise<S4BrowserGuard>;
