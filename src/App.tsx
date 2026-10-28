import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DesktopShell } from './components/DesktopShell';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NOVA interface error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-void p-6 text-white">
          <section className="glass-panel max-w-lg p-8 text-center">
            <p className="eyebrow">RECOVERY MODE</p>
            <h1 className="mt-3 text-2xl font-semibold">NOVA paused safely</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">An interface error occurred. Your local data has not been deleted. Reload to return to the desktop.</p>
            <button className="nova-button mt-6" onClick={() => window.location.reload()}>Reload NOVA</button>
            <details className="mt-5 text-left text-xs text-white/45">
              <summary className="cursor-pointer">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
            </details>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><DesktopShell /></ErrorBoundary>;
}
