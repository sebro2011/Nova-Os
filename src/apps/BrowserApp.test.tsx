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

  it('uses the official privacy-enhanced player for a mobile YouTube watch URL', async () => {
    const user = userEvent.setup();
    render(<BrowserApp />);

    const originalUrl = 'https://m.youtube.com/watch?v=w2pSFFG0AzY';
    await user.type(screen.getByLabelText('Address and search bar'), `${originalUrl}{enter}`);

    const frame = await screen.findByTitle('YouTube video player');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/w2pSFFG0AzY?rel=0&playsinline=1');
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect(frame).toHaveAttribute('allowfullscreen');
    expect(frame.getAttribute('allow')).toContain('picture-in-picture');
    expect(screen.getByLabelText('Address and search bar')).toHaveValue(originalUrl);
    expect(screen.queryByText('If this page is blank, the site may block embedded viewing.')).not.toBeInTheDocument();
  });

  it('continues to embed addresses without a known restriction', async () => {
    const user = userEvent.setup();
    render(<BrowserApp />);

    await user.type(screen.getByLabelText('Address and search bar'), 'example.com{enter}');

    const frame = await screen.findByTitle('NOVA Browser — example.com');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://example.com/');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(frame).not.toHaveAttribute('allowfullscreen');
    expect(screen.queryByRole('heading', { name: 'Open this site in a normal browser tab' })).not.toBeInTheDocument();
  });
});
