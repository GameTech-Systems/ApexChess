import { Component, type ReactNode } from "react";

export function ErrorFallback() {
  return (
    <main>
      <section role="alert" className="controls">
        <p>Something went wrong. Your saved setups are safe.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </section>
    </main>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}
