import { FilePlus2 } from 'lucide-react';
import { useOfficeDocument } from '../core/autosave/useOfficeDocument';
import { useI18n } from '../../../context/LocalizationContext';
import { OfficeLoading } from '../components/OfficeUI';
import SheetsWorkspace from './SheetsWorkspace';
import '../office.css';
import './sheets.css';

export default function SheetsApp() {
  const session = useOfficeDocument('sheets');
  const { t } = useI18n();
  if (!session.file || !session.data) {
    if (session.error) return <div className="office-centered-state"><p role="alert">{session.error}</p><button className="office-primary-button" onClick={() => void session.createNew()}><FilePlus2 size={14} />{t('office.newSpreadsheet')}</button></div>;
    return <OfficeLoading label={t('common.loading')} />;
  }
  return <SheetsWorkspace key={session.file.id} file={session.file} data={session.data} status={session.status} error={session.error} updateData={session.updateData} rename={session.rename} flush={session.flush} createNew={session.createNew} />;
}
