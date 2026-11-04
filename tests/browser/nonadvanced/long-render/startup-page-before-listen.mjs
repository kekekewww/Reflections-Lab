/**
 * The owning coordinator supplies its unchanged acquisition/listen deadlines and
 * retains the page before listen can fail. This helper adds no timeout or cleanup.
 * @template T
 * @param {{ acquirePage: () => T | Promise<T>, retainPage: (page: T) => void, listen: () => unknown | Promise<unknown> }} options
 * @returns {Promise<T>}
 */
export async function acquireOwnedPageBeforeListen({ acquirePage, retainPage, listen }) {
  if ([acquirePage, retainPage, listen].some((callback) => typeof callback !== "function"))
    throw new Error("STARTUP_PAGE_ORDER_CALLBACKS");
  const page = await acquirePage();
  const retention = /** @type {unknown} */ (retainPage(page));
  if (
    retention !== null &&
    (typeof retention === "object" || typeof retention === "function") &&
    typeof Reflect.get(retention, "then") === "function"
  ) {
    // A bad async retention callback must not cause an abandoned rejection.
    void Promise.resolve(retention).catch(() => undefined);
    throw new Error("STARTUP_PAGE_RETENTION_MUST_BE_SYNCHRONOUS");
  }
  await listen();
  return page;
}
