import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BrowserApp from './BrowserApp';

vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

vi.mock('../lib/db', () => ({
  initializeDatabase: vi.fn(async () => undefined),
  getAllRecords: vi.fn(async () => []),
  putRecord: vi.fn(async () => undefined),
  deleteRecord: vi.fn(async () => undefined),
  clearStore: vi.fn(async () => undefined),
}));

afterEach(cleanup);

describe('NOVA Browser embedding fallback', () => {
  it('shows an external-only screen for Google Search without creating an iframe', async () => {
    const user = userEvent.setup();
    render(<BrowserApp />);

    await user.type(screen.getByLabelText('Search the web'), 'nova');
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(await screen.findByRole('heading', { name: 'Open this site in a normal browser tab' })).toBeInTheDocument();
    expect(screen.getByText('Google Search does not allow other websites to embed its results.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open externally' })).toBeInTheDocument();
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('continues to embed addresses without a known restriction', async () => {
    const user = userEvent.setup();
    render(<BrowserApp />);

    await user.type(screen.getByLabelText('Address and search bar'), 'example.com{enter}');

    const frame = await screen.findByTitle('NOVA Browser — example.com');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://example.com/');
    expect(screen.queryByRole('heading', { name: 'Open this site in a normal browser tab' })).not.toBeInTheDocument();
  });
});
