import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchPalette } from './SearchPalette';
import { defaultPreferences } from '../lib/preferences';

vi.mock('../context/PreferencesContext', () => ({ usePreferences: () => ({ preferences: defaultPreferences }) }));
vi.mock('../lib/db', () => ({
  initializeDatabase: vi.fn(async () => undefined),
  getAllRecords: vi.fn(async (store: string) => store === 'notes' ? [{ id: 'n1', title: 'Unique orbit plan', content: 'Deep link target', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] : []),
}));

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

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

  it('keeps combobox navigation and the active option relationship keyboard-accessible', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    render(<SearchPalette onClose={vi.fn()} onOpen={vi.fn()} />);
    const input = screen.getByRole('combobox');
    const options = await screen.findAllByRole('option');

    expect(input).toHaveAttribute('aria-controls', 'search-results');
    fireEvent.keyDown(input, { key: 'End' });
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[options.length - 1].id);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    fireEvent.keyDown(input, { key: 'Home' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });
});
