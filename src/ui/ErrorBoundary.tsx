import { Component, type ReactNode } from 'react';

/** Any render error shows a way out instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="display text-[26px]">Something went wrong.</p>
        <p className="text-[var(--muted)]">Your progress is saved.</p>
        <button onClick={() => location.reload()} className="min-h-12 rounded-xl bg-[var(--accent)] px-6 font-semibold text-[var(--on-accent)]">
          Reload
        </button>
      </div>
    );
  }
}
