import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PdfViewer from './PdfViewer';
import { LocalizationProvider } from '../../../context/LocalizationContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { pdfBytesToDataUrl } from '../core/file-formats/pdf';
import type { FileNode } from '../../../types';

const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), downloadBlob: vi.fn() }));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument: mocks.getDocument, GlobalWorkerOptions: {} }));
vi.mock('../services/download', () => ({ downloadBlob: mocks.downloadBlob }));
vi.mock('./PdfPageCanvas', () => ({ default: ({ pageNumber, zoom, rotation }: { pageNumber: number; zoom: number; rotation: number }) => <div data-testid="pdf-page">Page {pageNumber} · zoom {zoom} · rotation {rotation}</div> }));

const file: FileNode = {
  id: 'pdf-ui', parentId: 'documents', name: 'Report.pdf', kind: 'file',
  content: pdfBytesToDataUrl(new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF')),
  mimeType: 'application/pdf', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), trashed: false,
};

function mockDocument(numPages = 3) {
  const document = {
    numPages,
    getPage: vi.fn(async (pageNumber: number) => ({
      getTextContent: async () => ({ items: [{ str: pageNumber === 2 ? 'Second Orbit page' : `Page ${pageNumber} ordinary text`, hasEOL: true }] }),
    })),
  };
  const task = { promise: Promise.resolve(document), destroy: vi.fn(async () => undefined), onProgress: undefined as unknown };
  mocks.getDocument.mockReturnValue(task);
  return { document, task };
}

function renderViewer() {
  return render(<PreferencesProvider><LocalizationProvider><PdfViewer file={file} /></LocalizationProvider></PreferencesProvider>);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('NOVA PDF viewer', () => {
  it('navigates, zooms, rotates, searches, downloads, and destroys the worker task', async () => {
    const { document, task } = mockDocument();
    const view = renderViewer();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 2');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('zoom 1.25');
    fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('rotation 90');

    fireEvent.click(screen.getByRole('button', { name: 'Search this PDF' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search this PDF' }), { target: { value: 'orbit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/Second Orbit page/)).toBeInTheDocument();
    expect(document.getPage).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Report.pdf');
    view.unmount();
    expect(task.destroy).toHaveBeenCalled();
  });

  it('rejects excessive page counts and cleans up the document task', async () => {
    const { task } = mockDocument(501);
    renderViewer();
    expect(await screen.findByRole('alert')).toHaveTextContent('up to 500 pages');
    expect(task.destroy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
