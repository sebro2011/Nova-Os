import { useState, type SetStateAction } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SlidesWorkspace from './SlidesWorkspace';
import { LocalizationProvider } from '../../../context/LocalizationContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import type { FileNode } from '../../../types';
import { createPresentationDocument, type PresentationDocument } from '../core/presentation-model/presentation-model';
import { serializeOfficeData } from '../core/file-formats/native';

const mocks = vi.hoisted(() => ({ downloadText: vi.fn(), downloadBlob: vi.fn() }));
vi.mock('../services/download', () => ({ downloadText: mocks.downloadText, downloadBlob: mocks.downloadBlob, readFileAsDataUrl: vi.fn() }));

const now = new Date().toISOString();
const file: FileNode = { id: 'slides-ui', parentId: 'documents', name: 'Deck.nwslides', kind: 'file', content: '', mimeType: 'application/x-nova-slides+json', createdAt: now, updatedAt: now, trashed: false };

function renderWorkspace(initialData = createPresentationDocument()) {
  const flush = vi.fn(async () => undefined);
  function Harness() {
    const [data, setData] = useState(initialData);
    const updateData = (update: SetStateAction<PresentationDocument>) => setData(update);
    return <PreferencesProvider><LocalizationProvider><SlidesWorkspace file={file} data={data} status="saved" error="" updateData={updateData} rename={vi.fn()} flush={flush} createNew={vi.fn(async () => undefined)} /></LocalizationProvider></PreferencesProvider>;
  }
  const view = render(<Harness />);
  return { ...view, flush };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('NOVA Slides workspace', () => {
  it('edits a real text object with bounded undo and redo', () => {
    renderWorkspace();
    fireEvent.click(screen.getAllByRole('button', { name: 'Select text object' })[0]);
    const editor = screen.getByLabelText('Text');
    fireEvent.change(editor, { target: { value: 'NOVA roadmap' } });
    expect(editor).toHaveValue('NOVA roadmap');
    expect(within(screen.getByRole('group', { name: 'Slide 1' })).getByText('NOVA roadmap')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(screen.getByRole('group', { name: 'Slide 1' })).getByText('Presentation title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(within(screen.getByRole('group', { name: 'Slide 1' })).getByText('NOVA roadmap')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Select text object' })[0]);
    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '500' } });
    expect(screen.getByLabelText('Font size')).toHaveValue(120);
  });

  it('adds, duplicates, deletes, and presents slides with keyboard navigation', () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add slide' }));
    expect(screen.getByRole('button', { name: 'Slide 2: Slide 2' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('button', { name: 'Slide 3: Slide 2 copy' })).toHaveAttribute('aria-current', 'page');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Slide 3: Slide 2 copy' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Slide 1: Slide 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Present' }));
    const presenter = screen.getByRole('region', { name: 'Presentation mode' });
    fireEvent.click(within(presenter).getByRole('button', { name: 'Next' }));
    expect(within(presenter).getByText('2 / 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(within(presenter).getByText('1 / 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Presentation mode' })).not.toBeInTheDocument();
  });

  it('imports and downloads native presentations without claiming PPTX import', async () => {
    const imported = createPresentationDocument('pitch');
    imported.slides[0].name = 'Imported deck';
    const serialized = serializeOfficeData('slides', imported);
    const { container, flush } = renderWorkspace();
    const input = container.querySelector<HTMLInputElement>('input[accept^=".nwslides"]');
    if (!input) throw new Error('Presentation import input is missing.');
    const selected = new File([''], 'imported.nwslides', { type: 'application/x-nova-slides+json' });
    Object.defineProperty(selected, 'text', { value: async () => serialized });
    fireEvent.change(input, { target: { files: [selected] } });
    expect(await screen.findByText('Imported deck')).toBeInTheDocument();

    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByRole('button', { name: 'Download NOVA presentation' }));
    await waitFor(() => expect(mocks.downloadText).toHaveBeenCalled());
    expect(flush).toHaveBeenCalled();
    const [content, name, mime] = mocks.downloadText.mock.calls[0] as [string, string, string];
    expect(name).toBe('Deck.nwslides');
    expect(mime).toBe('application/x-nova-slides+json');
    expect(content).toContain('Imported deck');
    expect(screen.getByRole('button', { name: 'Export PowerPoint (.pptx)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import PowerPoint/ })).not.toBeInTheDocument();
  });
});
