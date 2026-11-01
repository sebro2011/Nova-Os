import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MediaApp from './MediaApp';

vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ notify: vi.fn() }) }));

beforeEach(() => {
  let id = 0;
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:test-${++id}`),
    revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Media session object URLs', () => {
  it('revokes removed and unmounted local media URLs', () => {
    const view = render(<MediaApp />);
    const input = screen.getByLabelText('Add local media files');
    const file = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    fireEvent.click(screen.getByRole('button', { name: 'Remove song.mp3 from queue' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');

    fireEvent.change(input, { target: { files: [new File(['audio'], 'next.mp3', { type: 'audio/mpeg' })] } });
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-2');
  });
});
