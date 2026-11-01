import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Check, LoaderCircle, X } from 'lucide-react';
import { useI18n } from '../../../context/LocalizationContext';
import { useModalFocus } from '../../../hooks/useModalFocus';
import type { OfficeSaveStatus } from '../core/autosave/useOfficeDocument';

export function OfficeSaveIndicator({ status }: { status: OfficeSaveStatus }) {
  const { t } = useI18n();
  const label = status === 'saved' ? t('common.saved') : status === 'saving' || status === 'loading' ? t('common.saving') : status === 'error' ? t('common.error') : t('common.unsaved');
  return <span className={`office-save-status office-save-${status}`} role="status">{status === 'saved' ? <Check size={13} /> : status === 'saving' || status === 'loading' ? <LoaderCircle size={13} className="office-spin" /> : status === 'error' ? <AlertCircle size={13} /> : <span className="office-dirty-dot" />}{label}</span>;
}

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

export function OfficeToolbarButton({ label, active = false, children, className = '', ...props }: ToolbarButtonProps) {
  return <button type="button" className={`office-tool-button ${active ? 'is-active' : ''} ${className}`} aria-label={label} title={label} aria-pressed={active || undefined} onMouseDown={(event) => event.preventDefault()} {...props}>{children}</button>;
}

export function OfficeMenu({ label, icon, children, className = '' }: { label: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <details className={`office-menu ${className}`}><summary>{icon}{label}</summary><div className="office-menu-popover">{children}</div></details>;
}

export function OfficeDialog({ title, description, onClose, children, footer }: { title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useModalFocus<HTMLDivElement>(true, onClose);
  const { t } = useI18n();
  return <div className="office-dialog-backdrop"><div ref={ref} className="office-dialog" role="dialog" aria-modal="true" aria-labelledby="office-dialog-title" tabIndex={-1}><div className="office-dialog-heading"><div><h2 id="office-dialog-title">{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="office-tool-button" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button></div><div className="office-dialog-body">{children}</div>{footer && <div className="office-dialog-footer">{footer}</div>}</div></div>;
}

export function OfficeLoading({ label }: { label: string }) {
  return <div className="office-centered-state" role="status"><LoaderCircle className="office-spin" size={24} /><p>{label}</p></div>;
}

export function OfficeWarnings({ warnings, onDismiss }: { warnings: string[]; onDismiss?: () => void }) {
  const { t } = useI18n();
  if (!warnings.length) return null;
  return <section className="office-warning-list" aria-label={t('office.compatibility')}><AlertCircle size={16} /><div>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>{onDismiss && <button type="button" onClick={onDismiss} aria-label={t('office.dismissNotices')}><X size={14} /></button>}</section>;
}
