export interface ObserverPointerStart {
  pointerId: number;
  button: number;
  altKey: boolean;
  editor: boolean;
  gizmoDragging: boolean;
}

/** One physical camera gesture owns the pointer until release/cancel, even if Alt is released. */
export class ObserverGestureOwnership {
  private pointer: number | null = null;
  private primary = false;

  get pointerId(): number | null {
    return this.pointer;
  }

  get primaryOrbit(): boolean {
    return this.pointer !== null && this.primary;
  }

  begin(input: ObserverPointerStart): boolean {
    if (this.pointer !== null) return this.pointer === input.pointerId;
    if (!input.editor || input.gizmoDragging) return false;
    if (!(input.button === 1 || input.button === 2 || (input.button === 0 && input.altKey)))
      return false;
    this.pointer = input.pointerId;
    this.primary = input.button === 0;
    return true;
  }

  release(pointerId: number): boolean {
    if (this.pointer !== pointerId) return false;
    this.cancel();
    return true;
  }

  cancel(): void {
    this.pointer = null;
    this.primary = false;
  }

  permitsGizmo(pendingCommits: number): boolean {
    return this.pointer === null && pendingCommits === 0;
  }
}
