export const META_EXTENDED_AUTHORIZATIONS = Object.freeze({
  "artifact.meta-limits-20261104": Object.freeze({
    maxBudgetUsd: 5,
    maxRequests: 200,
    maxCompletionTokens: 16000,
    maxInputBytes: 128000,
  }),
  // A visitor's own key on the hosted site, spent from their own account. See browser-agent.ts.
  "artifact.visitor-key-20261105": Object.freeze({
    maxBudgetUsd: 3,
    maxRequests: 40,
    maxCompletionTokens: 16000,
    maxInputBytes: 128000,
  }),
});

export function metaExtendedAuthorization(id: string | null | undefined) {
  return id && Object.hasOwn(META_EXTENDED_AUTHORIZATIONS, id)
    ? META_EXTENDED_AUTHORIZATIONS[id as keyof typeof META_EXTENDED_AUTHORIZATIONS]
    : undefined;
}

/** Integer nanodollars, rounded up. Only the named exception releases unused reserves. */
export function metaConsumedUnits(
  authorizationId: string | null,
  reservationUnits: number,
  inputPrice: number,
  outputPrice: number,
  completed: boolean,
  usage: { promptTokens: number; completionTokens: number } | null,
): number {
  if (!metaExtendedAuthorization(authorizationId) || !completed || !usage) return reservationUnits;
  const estimate = Math.ceil(
    (usage.promptTokens * inputPrice + usage.completionTokens * outputPrice) * 1000,
  );
  return Math.min(reservationUnits, estimate);
}
