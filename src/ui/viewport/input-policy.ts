/** Explicit input arbitration; browser and UI shortcuts retain priority over FPS. */
export interface KeyboardPolicyInput {
  code: string;
  isComposing: boolean;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  typing: boolean;
  locked: boolean;
  running: boolean;
}

const fpsCodes = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyE",
  "KeyG",
  "KeyR",
  "KeyF",
  "KeyB",
  "KeyL",
  "ShiftLeft",
  "ShiftRight",
]);

export function acceptsFPSKey(input: KeyboardPolicyInput): boolean {
  return (
    input.locked &&
    input.running &&
    !input.typing &&
    !input.isComposing &&
    !input.repeat &&
    !input.ctrlKey &&
    !input.metaKey &&
    !input.altKey &&
    fpsCodes.has(input.code)
  );
}

export function isTypingElement(element: Element | null): boolean {
  if (!element) return false;
  return !!element.closest(
    "input, textarea, select, button, dialog, [role='dialog'], [contenteditable]:not([contenteditable='false'])",
  );
}

/**
 * Text entry owns the keyboard. Unlike isTypingElement, buttons, toggles and
 * sliders are not included: the no-lock alternative controls are buttons.
 */
export function isTextEntryElement(element: Element | null): boolean {
  if (!element) return false;
  return !!element.closest(
    "input:not([type='button']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='submit']):not([type='reset']), textarea, select, dialog, [role='dialog'], [contenteditable]:not([contenteditable='false'])",
  );
}
