import type { AppId, FileNode, ThemeName } from '../types';

export interface TerminalContext {
  openApp: (appId: AppId) => void;
  setTheme: (theme: ThemeName) => void;
  listFiles: () => Promise<FileNode[]>;
  hardwareConcurrency?: number;
}

export interface TerminalResult {
  lines: string[];
  clear?: boolean;
}

const appNames: Record<string, AppId> = {
  files: 'files', file: 'files', explorer: 'files',
  browser: 'browser', web: 'browser',
  terminal: 'terminal', shell: 'terminal',
  settings: 'settings', preferences: 'settings',
  notes: 'notes', note: 'notes',
  calculator: 'calculator', calc: 'calculator',
  calendar: 'calendar', events: 'calendar',
  media: 'media', player: 'media',
  apps: 'app-center', 'app-center': 'app-center',
  help: 'help',
};

/** Tokenizes only whitespace and quotes. It never invokes a shell or evaluates code. */
export function tokenizeCommand(input: string): string[] {
  if (input.length > 500) throw new Error('Command is too long.');
  const tokens: string[] = [];
  let token = '';
  let quote = '';
  let escaped = false;
  for (const character of input.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === '\\' && quote) {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = '';
      else token += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = '';
    } else {
      token += character;
    }
  }
  if (quote) throw new Error('Unclosed quote.');
  if (token) tokens.push(token);
  return tokens;
}

export async function executeTerminalCommand(input: string, context: TerminalContext): Promise<TerminalResult> {
  const tokens = tokenizeCommand(input);
  if (!tokens.length) return { lines: [] };
  const [rawCommand, ...args] = tokens;
  const command = rawCommand.toLowerCase();

  switch (command) {
    case 'help':
      return { lines: [
        'NOVA restricted command interpreter — available commands:',
        'help · clear · about · date · echo <text> · open <app>',
        'ls · pwd · theme <cosmic|midnight|nebula> · storage · sysinfo · whoami',
        'This is not a system shell. Shell commands and code execution are unavailable.',
      ] };
    case 'clear':
      return { lines: [], clear: true };
    case 'about':
      return { lines: ['NOVA Web OS 1.0 — Beyond Earth. Beyond Limits.', 'Local-first browser desktop. No backend required.'] };
    case 'date':
      return { lines: [new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(new Date())] };
    case 'echo':
      return { lines: [args.join(' ').slice(0, 400)] };
    case 'pwd':
      return { lines: ['/home/explorer'] };
    case 'whoami':
      return { lines: ['Local explorer · no account, tracking, or remote session'] };
    case 'open': {
      const appId = appNames[args[0]?.toLowerCase() ?? ''];
      if (!appId) return { lines: [`Unknown app. Try: ${Object.keys(appNames).slice(0, 10).join(', ')}`] };
      context.openApp(appId);
      return { lines: [`Opening ${appId}…`] };
    }
    case 'ls': {
      if (args.length) return { lines: ['Usage: ls (shows your virtual Home folder)'] };
      const files = await context.listFiles();
      const home = files.find((file) => file.id === 'home');
      const children = files.filter((file) => !file.trashed && file.parentId === (home?.id ?? 'root'));
      return { lines: children.length ? children.map((file) => `${file.kind === 'folder' ? '[dir]' : '     '} ${file.name}`) : ['(empty folder)'] };
    }
    case 'theme': {
      const theme = args[0]?.toLowerCase();
      if (theme !== 'cosmic' && theme !== 'midnight' && theme !== 'nebula') {
        return { lines: ['Usage: theme <cosmic|midnight|nebula>'] };
      }
      context.setTheme(theme);
      return { lines: [`Theme changed to ${theme}.`] };
    }
    case 'storage':
      return { lines: ['Structured data: IndexedDB · Preferences: LocalStorage', 'Browser storage is sandboxed and may be cleared by the browser or site-data settings. Export backups regularly.'] };
    case 'sysinfo':
      return { lines: [
        `Browser-reported logical CPU threads: ${context.hardwareConcurrency ?? 'not exposed'}`,
        'NOVA performance widget CPU/GPU/RAM values are simulated, not hardware telemetry.',
      ] };
    default:
      return { lines: [`Unknown restricted command: ${rawCommand}`, "Type 'help' for the command list. Nothing was executed."] };
  }
}
