"use client";

import { Component, type ReactNode } from "react";

type Phase4SectionBoundaryProps = { title: string; children: ReactNode };
type Phase4SectionBoundaryState = { failed: boolean };

/**
 * Keeps one failing closure section from replacing the whole event workspace.
 * The failed block keeps its frame, says what failed, and offers a Retry.
 */
export class Phase4SectionBoundary extends Component<Phase4SectionBoundaryProps, Phase4SectionBoundaryState> {
  state: Phase4SectionBoundaryState = { failed: false };

  static getDerivedStateFromError(): Phase4SectionBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`Closure section "${this.props.title}" failed to render`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-lg font-semibold text-foreground">{this.props.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">This section couldn’t load. The rest of the closure workspace is still available.</p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="mt-3 h-10 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground"
        >
          Retry
        </button>
      </section>
    );
  }
}
