import { FilePlus2 } from 'lucide-react';
import { useI18n } from '../../../context/LocalizationContext';
import { useOfficeDocument } from '../core/autosave/useOfficeDocument';
import { OfficeLoading } from '../components/OfficeUI';
import SlidesWorkspace from './SlidesWorkspace';
import '../office.css';
import './slides.css';

export default function SlidesApp() {
  const session = useOfficeDocument('slides');
  const { t } = useI18n();
  if (!session.file || !session.data) {
    if (session.error) return <div className="office-centered-state"><p role="alert">{session.error}</p><button className="office-primary-button" onClick={() => void session.createNew()}><FilePlus2 size={14} />{t('office.newPresentation')}</button></div>;
    return <OfficeLoading label={t('common.loading')} />;
  }
  return <SlidesWorkspace key={session.file.id} file={session.file} data={session.data} status={session.status} error={session.error} updateData={session.updateData} rename={session.rename} flush={session.flush} createNew={session.createNew} />;
}
