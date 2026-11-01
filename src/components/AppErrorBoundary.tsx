import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  appId: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Contains an application failure so the rest of the desktop remains available. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`NOVA app failed: ${this.props.appId}`, error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (previous.appId !== this.props.appId && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center" role="alert">
        <AlertTriangle size={28} className="text-amber-300" />
        <h2 className="mt-4 text-sm font-semibold text-ink/80">This app needs a fresh start</h2>
        <p className="mt-2 max-w-sm text-xs leading-5 text-muted">The rest of your NOVA desktop is still running. Retry the app without closing other windows.</p>
        <button className="nova-button mt-5" onClick={() => this.setState({ error: null })}>
          <RotateCcw size={14} /> Retry app
        </button>
      </div>
    );
  }
}
