import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TaskManagerApp from './TaskManagerApp';
import type { NovaWindow } from '../types';

const mocks = vi.hoisted(() => ({
  windows: [] as NovaWindow[],
  focusWindow: vi.fn(),
  minimizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

vi.mock('../context/WindowManagerContext', () => ({
  useWindowControls: () => ({ windows: mocks.windows, focusWindow: mocks.focusWindow, minimizeWindow: mocks.minimizeWindow, closeWindow: mocks.closeWindow }),
}));

function windowState(id: string, appId: NovaWindow['appId'], zIndex: number, minimized = false): NovaWindow {
  return { id, appId, zIndex, minimized, maximized: false, x: 8, y: 8, width: 700, height: 500 };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.windows = [];
});

describe('Task Manager real window state', () => {
  it('shows active, running, and minimized NOVA windows without fabricated telemetry', () => {
    mocks.windows = [windowState('window-files', 'files', 12), windowState('window-notes', 'notes', 11, true), windowState('window-task-manager', 'task-manager', 10)];
    render(<TaskManagerApp />);

    const summary = screen.getByLabelText('Window summary');
    expect(within(summary).getByText('Total windows').previousSibling).toHaveTextContent('3');
    expect(within(summary).getByText('Visible').previousSibling).toHaveTextContent('2');
    expect(within(summary).getByText('Minimized').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Minimized', { selector: 'article span' })).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.queryByText('SIMULATED')).not.toBeInTheDocument();
    expect(screen.queryByText('18%')).not.toBeInTheDocument();
    expect(screen.getByText(/cannot inspect per-app CPU/)).toBeInTheDocument();
  });

  it('uses the existing focus, minimize, and guarded close actions', () => {
    mocks.windows = [windowState('window-files', 'files', 12), windowState('window-notes', 'notes', 11, true)];
    render(<TaskManagerApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Restore Notes' }));
    expect(mocks.focusWindow).toHaveBeenCalledWith('window-notes');
    fireEvent.click(screen.getByRole('button', { name: 'Minimize Files' }));
    expect(mocks.minimizeWindow).toHaveBeenCalledWith('window-files');
    fireEvent.click(screen.getByRole('button', { name: 'Close Notes window' }));
    expect(mocks.closeWindow).toHaveBeenCalledWith('window-notes');
    expect(screen.getByRole('button', { name: 'Minimize Notes' })).toBeDisabled();
  });
});
