import { useEffect, useRef, useState } from 'react';
import { ChevronRight, LockKeyhole } from 'lucide-react';
import { useLauncher } from '../context/LaunchContext';
import { usePreferences } from '../context/PreferencesContext';
import { getAllRecords, initializeDatabase } from '../lib/db';
import { executeTerminalCommand } from '../lib/terminal';
import type { FileNode } from '../types';

interface TerminalLine {
  id: number;
  text: string;
  kind: 'command' | 'output' | 'system';
}

let nextLineId = 1;

export default function TerminalApp() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: nextLineId++, text: 'NOVA Terminal 1.0 · restricted interpreter', kind: 'system' },
    { id: nextLineId++, text: "Type 'help' to see available commands. This is not a system shell.", kind: 'system' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [commands, setCommands] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openApp } = useLauncher();
  const { updatePreferences } = usePreferences();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const submit = async () => {
    const command = input.trim();
    if (!command || busy) return;
    setBusy(true);
    setCommands((current) => [...current, command].slice(-50));
    setHistoryIndex(-1);
    setLines((current) => [...current, { id: nextLineId++, text: command, kind: 'command' }]);
    setInput('');
    try {
      const result = await executeTerminalCommand(command, {
        openApp,
        setTheme: (theme) => updatePreferences({ theme }),
        listFiles: async () => { await initializeDatabase(); return getAllRecords<FileNode>('files'); },
        hardwareConcurrency: navigator.hardwareConcurrency,
      });
      if (result.clear) setLines([]);
      else setLines((current) => [...current, ...result.lines.map((text) => ({ id: nextLineId++, text, kind: 'output' as const }))]);
    } catch (error) {
      setLines((current) => [...current, { id: nextLineId++, text: error instanceof Error ? error.message : 'Command failed safely.', kind: 'output' }]);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#050811]/95 font-mono" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-white/30"><LockKeyhole size={12} className="text-emerald-300/60" /> Restricted session <span className="ml-auto">NO CMD · NO POWERSHELL · NO EVAL</span></div>
      <div ref={scrollRef} className="app-scroll min-h-0 flex-1 overflow-y-auto p-4 text-[12px] leading-6" aria-live="polite">
        {lines.map((line) => line.kind === 'command' ? (
          <div key={line.id} className="flex gap-2 text-white/85"><span className="shrink-0 text-nova-cyan/70">explorer@nova<span className="text-white/30">:~$</span></span><span className="whitespace-pre-wrap break-all">{line.text}</span></div>
        ) : <div key={line.id} className={`whitespace-pre-wrap break-words ${line.kind === 'system' ? 'text-nova-blue/55' : 'text-white/50'}`}>{line.text}</div>)}
        {busy && <div className="text-white/30">Processing restricted command…</div>}
      </div>
      <form className="flex shrink-0 items-center gap-2 border-t border-white/[0.055] px-4 py-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <ChevronRight size={15} className="accent-text shrink-0" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white/85 caret-nova-cyan outline-none placeholder:text-white/20"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              const index = historyIndex < 0 ? commands.length - 1 : Math.max(0, historyIndex - 1);
              if (commands[index] !== undefined) { setHistoryIndex(index); setInput(commands[index]); }
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const index = historyIndex + 1;
              if (index >= commands.length) { setHistoryIndex(-1); setInput(''); }
              else { setHistoryIndex(index); setInput(commands[index]); }
            }
          }}
          placeholder="Enter a NOVA command…"
          maxLength={500}
          autoFocus
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Terminal command input"
          disabled={busy}
        />
      </form>
    </div>
  );
}
