import { memo, type ComponentType } from "react";
import type { LabController, LabViewModel } from "./contracts.js";

/** Exact equality for immutable read-model data. Functions/engine objects are
 * identity-only; numbers use Object.is (including NaN and signed zero). */
export function equalViewData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  // React elements carry owner graphs, rather than plain read-model data.
  if (Object.hasOwn(left, "$$typeof") || Object.hasOwn(right, "$$typeof")) return false;
  if (Array.isArray(left) && left.length !== (right as unknown[]).length) return false;
  const prototype = Object.getPrototypeOf(left);
  if (prototype !== Object.getPrototypeOf(right)) return false;
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null)
    return false;
  const a = left as Record<string, unknown>,
    b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && equalViewData(a[key], b[key]))
  );
}

/** Only plain read models enter this function, never React elements or engines. */
function shareViewData<T>(previous: T, next: T): T {
  if (equalViewData(previous, next)) return previous;
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") return next;
  if (Array.isArray(previous) !== Array.isArray(next)) return next;
  const prototype = Object.getPrototypeOf(next);
  if (
    prototype !== Object.getPrototypeOf(previous) ||
    (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null)
  )
    return next;
  const a = previous as Record<string, unknown>,
    b = next as Record<string, unknown>;
  const keys = Object.keys(b);
  let equal = keys.length === Object.keys(a).length;
  const shared: Record<string, unknown> = Array.isArray(next)
    ? (new Array(next.length) as unknown as Record<string, unknown>)
    : Object.create(prototype);
  if (Array.isArray(next) && next.length !== (previous as unknown[]).length) equal = false;
  for (const key of keys) {
    const value = Object.hasOwn(a, key) ? shareViewData(a[key], b[key]) : b[key];
    if (key === "__proto__")
      Object.defineProperty(shared, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    else shared[key] = value;
    if (!Object.hasOwn(a, key) || !Object.is(shared[key], a[key])) equal = false;
  }
  return equal ? previous : (shared as T);
}

/** Cache by the controller's immutable snapshot identity. Every new publication
 * keeps a new root, even with equal contents: some panels read live optional
 * controller ports during render. Commands retain the authoritative snapshot. */
export function createReactViewStore(controller: LabController) {
  let source: LabViewModel | undefined;
  let view: LabViewModel;
  return {
    subscribe: controller.subscribe.bind(controller),
    getSnapshot: () => {
      const next = controller.getSnapshot();
      if (next !== source) {
        const shared = source ? shareViewData(view, next) : next;
        view = source && shared === view ? { ...shared } : shared;
        source = next;
      }
      return view;
    },
  };
}

/** Select all render AND handler inputs. Callback props must compare by identity;
 * never ignore a new closure to obtain a memo hit. Context/state still update. */
export function memoView<P extends object>(
  component: ComponentType<P>,
  inputs: (props: P) => unknown = (props) => props,
) {
  return memo(component, (previous, next) => equalViewData(inputs(previous), inputs(next)));
}
