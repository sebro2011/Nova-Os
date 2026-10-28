import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

export function AppLoading({ label = 'Loading local data…' }: { label?: string }) {
  return <div className="flex h-full min-h-32 items-center justify-center gap-2 text-xs text-white/40" role="status"><Loader2 size={17} className="animate-spin" />{label}</div>;
}

export function AppError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center p-6 text-center" role="alert">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-400/10 text-red-300"><AlertCircle size={20} /></span>
      <h3 className="mt-4 text-sm font-semibold text-white/85">NOVA couldn’t open local data</h3>
      <p className="mt-2 max-w-md text-xs leading-5 text-white/45">{message}</p>
      {onRetry && <button className="nova-button nova-button-secondary mt-5" onClick={onRetry}><RefreshCw size={14} /> Retry</button>}
    </div>
  );
}
