// src/components/ErrorBoundary.tsx
import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      this.props.fallback ?? (
        <div className="rounded-2xl bg-slate-900/80 border border-rose-500/50 p-4 text-sm text-slate-200">
          <div className="font-semibold text-rose-200 mb-1">
            This panel crashed (isolated)
          </div>
          <div className="text-slate-300">
            Open the browser console to see the exact error stack.
          </div>
        </div>
      )
    );
  }
}

