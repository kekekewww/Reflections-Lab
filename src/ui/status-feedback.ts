export interface StatusFeedbackInput {
  readonly notice?: string;
  readonly pauseReason?: string;
}

/** Show the latest outcome without hiding the still-active reason for paused time. */
export function statusFeedbackMessages(
  input: StatusFeedbackInput,
  resolveMessage: (raw: string) => string = (raw) => raw,
): string[] {
  const result: string[] = [];
  for (const raw of [input.notice, input.pauseReason]) {
    if (!raw?.trim()) continue;
    const text = resolveMessage(raw);
    if (text.trim() && !result.includes(text)) result.push(text);
  }
  return result;
}
