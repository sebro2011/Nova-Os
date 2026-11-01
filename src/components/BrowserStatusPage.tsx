import { ExternalLink, Home, Octagon, RotateCw, WifiOff, type LucideIcon } from 'lucide-react';

export type BrowserStatusKind = 'external' | 'stopped' | 'offline';

interface BrowserStatusPageProps {
  kind: BrowserStatusKind;
  url: string;
  description?: string;
  onOpenExternally: () => void;
  onReload: () => void;
  onHome: () => void;
}

const statusCopy: Record<BrowserStatusKind, { eyebrow: string; title: string; description: string; detail: string; icon: LucideIcon }> = {
  external: {
    eyebrow: 'EXTERNAL-ONLY PAGE',
    title: 'Open this site in a normal browser tab',
    description: '',
    detail: 'NOVA cannot override another site’s X-Frame-Options or Content-Security-Policy. Your current tab and address stay here while the site opens separately.',
    icon: ExternalLink,
  },
  stopped: {
    eyebrow: 'NAVIGATION STOPPED',
    title: 'Loading stopped',
    description: 'NOVA removed the embedded page to stop its pending load.',
    detail: 'The address and this tab’s NOVA navigation history were preserved. Reload when you are ready, or continue in an external browser tab.',
    icon: Octagon,
  },
  offline: {
    eyebrow: 'NETWORK UNAVAILABLE',
    title: 'You appear to be offline',
    description: 'Your browser currently reports no network connection, so NOVA is not attempting this embedded load.',
    detail: 'NOVA cannot determine the remote site’s availability. Reconnect and retry, or open the preserved address externally if your browser has a cached copy.',
    icon: WifiOff,
  },
};

export function BrowserStatusPage({ kind, url, description, onOpenExternally, onReload, onHome }: BrowserStatusPageProps) {
  const copy = statusCopy[kind];
  const Icon = copy.icon;
  const primaryAction = kind === 'external' ? onOpenExternally : onReload;
  const PrimaryIcon = kind === 'external' ? ExternalLink : RotateCw;

  return (
    <div className="app-scroll h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.08),transparent_55%)] p-5" role="status" aria-live="polite">
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center py-6 text-center">
        <span className="accent-surface flex h-14 w-14 items-center justify-center rounded-2xl"><Icon size={25} /></span>
        <p className="eyebrow mt-5">{copy.eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink/85">{copy.title}</h2>
        <p className="mt-3 text-xs leading-6 text-ink/65">{description || copy.description}</p>
        <p className="mt-2 text-[11px] leading-5 text-muted">{copy.detail}</p>
        <p className="mt-4 line-clamp-2 max-w-full break-all rounded-lg bg-ink/[0.035] px-3 py-2 text-[10px] text-muted" title={url}>{url}</p>
        <div className="mt-6 flex w-full flex-wrap justify-center gap-2 sm:w-auto">
          <button className="nova-button" onClick={primaryAction}>
            <PrimaryIcon size={16} />{kind === 'external' ? 'Open externally' : kind === 'offline' ? 'Retry connection' : 'Reload page'}
          </button>
          {kind !== 'external' && <button className="nova-button nova-button-secondary" onClick={onOpenExternally}><ExternalLink size={15} /> Open externally</button>}
          <button className="nova-button nova-button-secondary" onClick={onHome}><Home size={15} /> NOVA Browser home</button>
        </div>
      </div>
    </div>
  );
}
