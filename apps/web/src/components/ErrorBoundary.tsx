import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown instead of the crashed subtree. */
  label: string;
}

interface State {
  error: Error | null;
}

/**
 * One boundary per rail, so a bad spec that breaks the canvas does not take the
 * editor down with it — losing the editor would mean losing the only way to fix
 * the spec that caused the crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[playground]', this.props.label, error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div className="m-3 rounded-bench border border-reg/50 bg-reg/5 p-4">
        <p className="text-sm text-reg">{this.props.label} stopped working.</p>
        <p className="mt-1 tabular text-tiny text-ink-2">{error.message}</p>
        <button
          type="button"
          className="mt-3 rounded-bench border border-rule px-2 py-1 text-tiny text-ink-2 hover:border-guide hover:text-ink"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
