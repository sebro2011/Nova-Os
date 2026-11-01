import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BrowserApp from './BrowserApp';

const mocks = vi.hoisted(() => ({
  intent: undefined as { url?: string } | undefined,
  consumeLaunchIntent: vi.fn(() => {
    const intent = mocks.intent;
    mocks.intent = undefined;
    return intent;
  }),
}));

vi.mock('../context/LaunchContext', () => ({
  useLauncher: () => ({ consumeLaunchIntent: mocks.consumeLaunchIntent }),
}));

vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

vi.mock('../lib/db', () => ({
  initializeDatabase: vi.fn(async () => undefined),
  getAllRecords: vi.fn(async () => []),
  putRecord: vi.fn(async () => undefined),
  deleteRecord: vi.fn(async () => undefined),
  deleteRecords: vi.fn(async () => undefined),
  clearStore: vi.fn(async () => undefined),
}));

afterEach(() => {
  cleanup();
  mocks.intent = undefined;
  mocks.consumeLaunchIntent.mockClear();
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
});

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
    expect(frame).toHaveAttribute('allowfullscreen');
    expect(frame).toHaveAttribute('allow', 'fullscreen');
    expect(screen.queryByRole('heading', { name: 'Open this site in a normal browser tab' })).not.toBeInTheDocument();
  });

  it('opens GitHub externally without losing the preserved NOVA tab address', async () => {
    const user = userEvent.setup();
    const opened = { opener: window };
    const open = vi.spyOn(window, 'open').mockReturnValue(opened as unknown as Window);
    render(<BrowserApp />);

    const url = 'https://github.com/sebro2011/Nova-Os';
    await user.type(screen.getByLabelText('Address and search bar'), `${url}{enter}`);
    expect(await screen.findByText(/GitHub’s main website protects/)).toBeInTheDocument();
    expect(document.querySelector('iframe')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open externally' }));
    expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    expect(opened.opener).toBeNull();
    expect(screen.getByLabelText('Address and search bar')).toHaveValue(url);
  });

  it('stops an embedded load and reloads it without discarding context', async () => {
    const user = userEvent.setup();
    render(<BrowserApp />);

    await user.type(screen.getByLabelText('Address and search bar'), 'example.com{enter}');
    expect(await screen.findByTitle('NOVA Browser — example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop loading' }));

    expect(screen.getByRole('heading', { name: 'Loading stopped' })).toBeInTheDocument();
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Address and search bar')).toHaveValue('https://example.com/');

    await user.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(await screen.findByTitle('NOVA Browser — example.com')).toBeInTheDocument();
  });

  it('requests fullscreen through a user-initiated supported API', async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen });
    render(<BrowserApp />);

    await user.type(screen.getByLabelText('Address and search bar'), 'example.com{enter}');
    await screen.findByTitle('NOVA Browser — example.com');
    await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('opens website launch intents through the existing embedding policy pipeline', async () => {
    mocks.intent = { url: 'https://github.com/sebro2011/Nova-Os' };
    render(<BrowserApp />);

    expect(await screen.findByRole('heading', { name: 'Open this site in a normal browser tab' })).toBeInTheDocument();
    expect(screen.getByLabelText('Address and search bar')).toHaveValue('https://github.com/sebro2011/Nova-Os');
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('shows an honest offline page instead of attempting a frame', async () => {
    const user = userEvent.setup();
    const online = vi.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(false);
    render(<BrowserApp />);

    await user.type(screen.getByLabelText('Address and search bar'), 'example.com{enter}');
    expect(await screen.findByRole('heading', { name: 'You appear to be offline' })).toBeInTheDocument();
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Address and search bar')).toHaveValue('https://example.com/');

    online.mockReturnValue(true);
    fireEvent(window, new Event('online'));
    expect(await screen.findByTitle('NOVA Browser — example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop loading' })).toBeInTheDocument();
    online.mockRestore();
  });
});
