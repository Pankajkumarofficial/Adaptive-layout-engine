/** Thrown by `normalize` when a spec or surface cannot be solved at all. */
export class SpecError extends Error {
  readonly code: 'INVALID_SPEC' | 'INVALID_SURFACE' | 'EMPTY_CONTENT_BOX';
  readonly issues: readonly SpecIssue[];

  constructor(code: SpecError['code'], message: string, issues: readonly SpecIssue[] = []) {
    super(message);
    this.name = 'SpecError';
    this.code = code;
    this.issues = issues;
  }

  toJSON(): { code: string; message: string; issues: readonly SpecIssue[] } {
    return { code: this.code, message: this.message, issues: this.issues };
  }
}

export interface SpecIssue {
  path: string;
  message: string;
}
