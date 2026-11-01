import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStore } from '../../../lib/db';
import { createWriterDocument } from '../core/document-model/writer-model';
import { deleteOfficeRevisions, listOfficeRevisions, loadOfficeRevision, recordOfficeRevision } from './office-revisions';

beforeEach(async () => clearStore('meta'));

describe('bounded Office revision history', () => {
  it('records, lists, restores, and deletes local snapshots', async () => {
    const original = createWriterDocument();
    expect(await recordOfficeRevision('office-1', 'writer', original, true)).toBe(true);
    const changed = createWriterDocument('meeting');
    expect(await recordOfficeRevision('office-1', 'writer', changed, true)).toBe(true);
    const revisions = await listOfficeRevisions('office-1');
    expect(revisions).toHaveLength(2);
    expect(await loadOfficeRevision('office-1', revisions[0].id, 'writer')).toEqual(changed);
    expect(await loadOfficeRevision('office-1', revisions[1].id, 'writer')).toEqual(original);
    await deleteOfficeRevisions('office-1');
    expect(await listOfficeRevisions('office-1')).toEqual([]);
  });

  it('throttles automatic snapshots and skips oversized revision copies without blocking saves', async () => {
    const document = createWriterDocument();
    expect(await recordOfficeRevision('office-2', 'writer', document)).toBe(true);
    expect(await recordOfficeRevision('office-2', 'writer', createWriterDocument('letter'))).toBe(false);
    const large = createWriterDocument();
    large.content = { type: 'doc', content: Array.from({ length: 4 }, () => ({ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(200_000) }] })) };
    expect(await recordOfficeRevision('office-large', 'writer', large, true)).toBe(false);
    expect(await listOfficeRevisions('office-large')).toEqual([]);
  });
});
