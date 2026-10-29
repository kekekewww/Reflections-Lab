export class SceneError extends Error {
  readonly code: string;
  readonly details: readonly string[];

  constructor(code: string, message: string, details: readonly string[] = []) {
    super(message);
    this.name = "SceneError";
    this.code = code;
    this.details = details;
  }
}
