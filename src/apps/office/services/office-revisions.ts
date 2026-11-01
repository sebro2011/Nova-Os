import { deleteRecord, getRecord, putRecord } from '../../../lib/db';
import { createId } from '../../../lib/utils';
import type { OfficeDocumentKind } from '../core/file-formats/constants';
import { parseOfficeData, serializeOfficeData, type OfficeDataMap } from '../core/file-formats/native';

const REVISION_PREFIX = 'office-revisions:';
const MAX_REVISIONS = 6;
const MAX_REVISION_CHARS = 750_000;
const MAX_REVISION_SET_CHARS = 3_000_000;
const REVISION_INTERVAL_MS = 60_000;

interface StoredRevision { id: string; createdAt: string; content: string }
interface StoredRevisionSet { version: 1; revisions: StoredRevision[] }
interface RevisionMetaRecord { key: string; value: string }
export interface OfficeRevisionInfo { id: string; createdAt: string }

function revisionKey(fileId: string): string {
  if (!/^[A-Za-z0-9_-]{1,140}$/.test(fileId)) throw new Error('Invalid Office file ID for revision history.');
  return `${REVISION_PREFIX}${fileId}`;
}

async function readSet(fileId: string): Promise<StoredRevisionSet> {
  const record = await getRecord<RevisionMetaRecord>('meta', revisionKey(fileId));
  if (!record) return { version: 1, revisions: [] };
  if (record.value.length > MAX_REVISION_SET_CHARS) return { version: 1, revisions: [] };
  try {
    const parsed = JSON.parse(record.value) as StoredRevisionSet;
    if (parsed.version !== 1 || !Array.isArray(parsed.revisions)) return { version: 1, revisions: [] };
    return { version: 1, revisions: parsed.revisions.filter((revision) => revision && typeof revision.id === 'string' && typeof revision.createdAt === 'string' && typeof revision.content === 'string').slice(0, MAX_REVISIONS) };
  } catch {
    return { version: 1, revisions: [] };
  }
}

export async function recordOfficeRevision<K extends OfficeDocumentKind>(fileId: string, kind: K, data: OfficeDataMap[K], force = false): Promise<boolean> {
  const content = serializeOfficeData(kind, data);
  if (content.length > MAX_REVISION_CHARS) return false;
  const current = await readSet(fileId);
  const newest = current.revisions[0];
  const now = Date.now();
  if (newest && (newest.content === content || (!force && now - Date.parse(newest.createdAt) < REVISION_INTERVAL_MS))) return false;
  const revision: StoredRevision = { id: createId('revision'), createdAt: new Date(now).toISOString(), content };
  let revisions = [revision, ...current.revisions].slice(0, MAX_REVISIONS);
  while (revisions.length > 1 && JSON.stringify({ version: 1, revisions }).length > MAX_REVISION_SET_CHARS) revisions = revisions.slice(0, -1);
  await putRecord('meta', { key: revisionKey(fileId), value: JSON.stringify({ version: 1, revisions } satisfies StoredRevisionSet) } satisfies RevisionMetaRecord);
  return true;
}

export async function listOfficeRevisions(fileId: string): Promise<OfficeRevisionInfo[]> {
  const current = await readSet(fileId);
  return current.revisions.map(({ id, createdAt }) => ({ id, createdAt }));
}

export async function loadOfficeRevision<K extends OfficeDocumentKind>(fileId: string, revisionId: string, kind: K): Promise<OfficeDataMap[K]> {
  const current = await readSet(fileId);
  const revision = current.revisions.find((item) => item.id === revisionId);
  if (!revision) throw new Error('This local revision no longer exists.');
  return parseOfficeData(kind, revision.content);
}

export async function deleteOfficeRevisions(fileId: string): Promise<void> {
  await deleteRecord('meta', revisionKey(fileId));
}
