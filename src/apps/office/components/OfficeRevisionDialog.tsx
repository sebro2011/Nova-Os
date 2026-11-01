import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { useI18n } from '../../../context/LocalizationContext';
import { errorMessage } from '../../../lib/utils';
import type { OfficeDocumentKind } from '../core/file-formats/constants';
import type { OfficeData } from '../core/file-formats/native';
import { listOfficeRevisions, loadOfficeRevision, type OfficeRevisionInfo } from '../services/office-revisions';
import { OfficeDialog, OfficeLoading } from './OfficeUI';

export default function OfficeRevisionDialog({ fileId, kind, onClose, onRestore }: { fileId: string; kind: OfficeDocumentKind; onClose: () => void; onRestore: (data: OfficeData) => void }) {
  const { t, formatDate } = useI18n();
  const [revisions, setRevisions] = useState<OfficeRevisionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    listOfficeRevisions(fileId).then((items) => { if (active) setRevisions(items); }).catch((caught) => { if (active) setError(errorMessage(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fileId]);
  const restore = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const data = await loadOfficeRevision(fileId, id, kind);
      onRestore(data);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyId('');
    }
  };
  return <OfficeDialog title={t('office.revisionHistory')} description={t('office.revisionDescription')} onClose={onClose}>
    {loading ? <OfficeLoading label={t('common.loading')} /> : error ? <p role="alert">{error}</p> : revisions.length === 0 ? <p className="office-panel-note">{t('office.noRevisions')}</p> : <div className="office-revision-list">{revisions.map((revision) => <button key={revision.id} type="button" disabled={Boolean(busyId)} onClick={() => void restore(revision.id)}><History size={15} /><span><strong>{formatDate(revision.createdAt)}</strong><small>{t('office.localRevision')}</small></span><RotateCcw size={14} /></button>)}</div>}
  </OfficeDialog>;
}
