import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { useModalFocus } from './useModalFocus';

function Example() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open dialog</button>{open && <Dialog onClose={() => setOpen(false)} />}</>;
}

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useModalFocus<HTMLDivElement>(true, onClose);
  return <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true"><button autoFocus>First action</button><button>Last action</button></div>;
}

afterEach(cleanup);

describe('modal focus management', () => {
  it('contains Tab navigation, closes with Escape, and restores the trigger', () => {
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    fireEvent.click(trigger);
    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    expect(first).toHaveFocus();
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
