export interface NumberFieldDraft {
  readonly raw: string;
  readonly dirty: boolean;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

export type NumberFieldCommitTrigger =
  | { readonly type: "blur"; readonly intent: "locale" | "other" }
  | { readonly type: "enter"; readonly isComposing: boolean };

export type NumberFieldCommitDecision =
  | { readonly kind: "retain" }
  | { readonly kind: "invalid" }
  | { readonly kind: "commit"; readonly value: number };

/** Raw drafts may block dependent actions before a field is explicitly committed. */
export function isNumberFieldDraftValid(
  draft: Pick<NumberFieldDraft, "raw" | "min" | "max">,
  invalidReason?: (value: number) => string | undefined,
): boolean {
  const decision = decideNumberFieldCommit(
    { ...draft, dirty: true },
    { type: "enter", isComposing: false },
  );
  return decision.kind === "commit" && !invalidReason?.(decision.value);
}

/** Presentation changes retain drafts; explicit field commits use the existing numeric rules. */
export function decideNumberFieldCommit(
  draft: NumberFieldDraft,
  trigger: NumberFieldCommitTrigger,
): NumberFieldCommitDecision {
  if (
    !draft.dirty ||
    (trigger.type === "blur" && trigger.intent === "locale") ||
    (trigger.type === "enter" && trigger.isComposing)
  )
    return { kind: "retain" };

  const value = Number(draft.raw);
  if (
    draft.raw.trim() === "" ||
    !Number.isFinite(value) ||
    (draft.min !== undefined && value < draft.min) ||
    (draft.max !== undefined && value > draft.max)
  )
    return { kind: "invalid" };

  return { kind: "commit", value };
}
