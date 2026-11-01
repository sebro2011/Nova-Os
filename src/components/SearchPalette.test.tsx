import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchPalette } from './SearchPalette';
import { defaultPreferences } from '../lib/preferences';

vi.mock('../context/PreferencesContext', () => ({ usePreferences: () => ({ preferences: defaultPreferences }) }));
vi.mock('../lib/db', () => ({
  initializeDatabase: vi.fn(async () => undefined),
  getAllRecords: vi.fn(async (store: string) => store === 'notes' ? [{ id: 'n1', title: 'Unique orbit plan', content: 'Deep link target', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] : []),
}));

afterEach(cleanup);

describe('global search actions', () => {
  it('opens the selected note rather than only its app', async () => {
    const onOpen = vi.fn();
    render(<SearchPalette onClose={vi.fn()} onOpen={onOpen} />);
    fireEvent.change(screen.getByPlaceholderText(/Search apps, files/), { target: { value: 'unique orbit' } });
    const result = await screen.findByText('Unique orbit plan');
    fireEvent.click(result.closest('button')!);
    expect(onOpen).toHaveBeenCalledWith('notes', { recordId: 'n1' });
  });

  it('deep-links settings actions to the requested section', async () => {
    const onOpen = vi.fn();
    render(<SearchPalette onClose={vi.fn()} onOpen={onOpen} />);
    fireEvent.change(screen.getByPlaceholderText(/Search apps, files/), { target: { value: 'backups' } });
    const result = await screen.findByText('Storage & backups');
    fireEvent.click(result.closest('button')!);
    expect(onOpen).toHaveBeenCalledWith('settings', { section: 'data' });
  });
});
