import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WriterWorkspace from './WriterWorkspace';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { LocalizationProvider } from '../../../context/LocalizationContext';
import { createWriterDocument, type WriterDocument } from '../core/document-model/writer-model';
import type { FileNode } from '../../../types';

const now = new Date().toISOString();
const file: FileNode = { id: 'writer-ui', parentId: 'documents', name: 'Report.nwdoc', kind: 'file', content: '', mimeType: 'application/x-nova-writer+json', createdAt: now, updatedAt: now, trashed: false };

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('Writer workspace interactions', () => {
  it('uses the real editor for find and one-action replace-all', async () => {
    const data = createWriterDocument();
    data.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alpha beta alpha' }] }] };
    const updateData = vi.fn();
    render(<PreferencesProvider><LocalizationProvider><WriterWorkspace file={file} data={data} status="saved" error="" updateData={updateData} rename={vi.fn()} flush={vi.fn(async () => {})} createNew={vi.fn(async () => {})} /></LocalizationProvider></PreferencesProvider>);
    await waitFor(() => expect(screen.getByLabelText('Document content')).toHaveTextContent('Alpha beta alpha'));
    fireEvent.click(screen.getByRole('button', { name: 'Find' }));
    fireEvent.change(screen.getByPlaceholderText('Find'), { target: { value: 'alpha' } });
    await screen.findByText('2 matches');
    fireEvent.change(screen.getByPlaceholderText('Replace'), { target: { value: 'Gamma' } });
    const replaceAll = screen.getByRole('button', { name: 'Replace all' });
    await waitFor(() => expect(replaceAll).toBeEnabled());
    fireEvent.click(replaceAll);
    await waitFor(() => expect(updateData).toHaveBeenCalled());
    const latest = updateData.mock.calls[updateData.mock.calls.length - 1]?.[0] as WriterDocument;
    expect(JSON.stringify(latest.content)).toContain('Gamma');
    expect(JSON.stringify(latest.content)).not.toContain('Alpha');
    expect(screen.getByLabelText('Document content')).toHaveTextContent('Gamma beta Gamma');
  });
});
