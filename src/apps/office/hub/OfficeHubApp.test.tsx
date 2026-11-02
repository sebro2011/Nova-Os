import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeHubApp from './OfficeHubApp';
import { LaunchProvider, type LaunchContextValue } from '../../../context/LaunchContext';
import { LocalizationProvider } from '../../../context/LocalizationContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { clearStore, initializeDatabase } from '../../../lib/db';
import { createOfficeFile, createPdfFile, loadOfficeFile } from '../services/office-storage';

const mocks = vi.hoisted(() => ({ openApp: vi.fn() }));
const launch: LaunchContextValue = { openApp: mocks.openApp, closeActiveWindow: vi.fn(), consumeLaunchIntent: vi.fn() };

function renderHub() {
  return render(<LaunchProvider value={launch}><PreferencesProvider><LocalizationProvider><OfficeHubApp /></LocalizationProvider></PreferencesProvider></LaunchProvider>);
}

beforeEach(async () => {
  await clearStore('files');
  await clearStore('meta');
  await initializeDatabase();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('NOVA Office Hub', () => {
  it('finds native documents and PDFs and opens them in the correct app', async () => {
    const writer = await createOfficeFile('writer', 'Roadmap');
    await createOfficeFile('slides', 'Product deck', 'pitch');
    const pdf = await createPdfFile('Reference', new TextEncoder().encode('%PDF-1.4\n%%EOF'));
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: /All documents/ }));
    const writerButton = await screen.findByRole('button', { name: /Roadmap\.nwdoc/ });
    expect(screen.getByRole('button', { name: /Product deck\.nwslides/ })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search local documents'), { target: { value: 'Roadmap' } });
    expect(screen.queryByRole('button', { name: /Product deck\.nwslides/ })).not.toBeInTheDocument();
    fireEvent.click(writerButton);
    expect(mocks.openApp).toHaveBeenCalledWith('writer', { recordId: writer.file.id });

    fireEvent.change(screen.getByPlaceholderText('Search local documents'), { target: { value: 'Reference' } });
    fireEvent.click(await screen.findByRole('button', { name: /Reference\.pdf/ }));
    expect(mocks.openApp).toHaveBeenCalledWith('pdf', { recordId: pdf.id });
  });

  it('creates a real pitch template and launches its canonical record', async () => {
    renderHub();
    fireEvent.click(await screen.findByRole('button', { name: /Templates/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pitch deck/ }));
    await waitFor(() => expect(mocks.openApp).toHaveBeenCalledWith('slides', expect.anything()));
    const [app, intent] = mocks.openApp.mock.calls[0] as ['slides', { recordId: string }];
    expect(app).toBe('slides');
    const loaded = await loadOfficeFile(intent.recordId, 'slides');
    expect(loaded.file.name).toBe('Untitled presentation.nwslides');
    expect(loaded.data.slides[0].objects.some((object) => object.type === 'text' && object.text.includes('Productivity'))).toBe(true);
  });
});
