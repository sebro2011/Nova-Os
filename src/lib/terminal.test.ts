import { describe, expect, it, vi } from 'vitest';
import { executeTerminalCommand, tokenizeCommand, type TerminalContext } from './terminal';

function context(): TerminalContext {
  return {
    openApp: vi.fn(),
    setTheme: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    hardwareConcurrency: 4,
  };
}

describe('restricted terminal', () => {
  it('tokenizes whitespace and quotes without a shell', () => {
    expect(tokenizeCommand('echo "hello nova"')).toEqual(['echo', 'hello nova']);
    expect(() => tokenizeCommand('echo "unclosed')).toThrow('Unclosed quote');
  });

  it('executes only whitelisted app launches', async () => {
    const ctx = context();
    const result = await executeTerminalCommand('open notes', ctx);
    expect(result.lines[0]).toContain('notes');
    expect(ctx.openApp).toHaveBeenCalledWith('notes');
  });

  it('treats shell-looking echo input as inert text', async () => {
    const ctx = context();
    const result = await executeTerminalCommand('echo $(rm -rf /); whoami', ctx);
    expect(result.lines).toEqual(['$(rm -rf /); whoami']);
    expect(ctx.openApp).not.toHaveBeenCalled();
  });

  it('rejects unknown commands without performing actions', async () => {
    const ctx = context();
    const result = await executeTerminalCommand('powershell Get-Process', ctx);
    expect(result.lines.join(' ')).toContain('Nothing was executed');
    expect(ctx.openApp).not.toHaveBeenCalled();
    expect(ctx.setTheme).not.toHaveBeenCalled();
  });

  it('labels performance information honestly', async () => {
    const result = await executeTerminalCommand('sysinfo', context());
    expect(result.lines.join(' ')).toContain('simulated');
  });
});
