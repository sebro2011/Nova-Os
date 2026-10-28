import { useState } from 'react';
import { AppWindow, Command, Database, Globe2, Keyboard, ShieldCheck } from 'lucide-react';
import { useLauncher } from '../context/LaunchContext';

const shortcuts = [
  ['Ctrl + K', 'Open global search'],
  ['Ctrl + Alt + T', 'Open the restricted Terminal'],
  ['Alt + M', 'Minimize the active window'],
  ['Alt + W', 'Close the active window'],
  ['F1', 'Open Help Center'],
  ['Escape', 'Close menus and overlays'],
  ['Enter', 'Open a focused desktop icon or file'],
  ['Double-click', 'Open desktop icons, folders, and files'],
];

const sections = [
  { id: 'start', label: 'Getting started', icon: AppWindow },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard },
  { id: 'storage', label: 'Storage & backups', icon: Database },
  { id: 'security', label: 'Security & sandbox', icon: ShieldCheck },
  { id: 'browser', label: 'Browser boundaries', icon: Globe2 },
];

export default function HelpApp() {
  const [section, setSection] = useState('start');
  const { openApp } = useLauncher();

  return (
    <div className="flex h-full bg-black/5">
      <aside className="hidden w-48 shrink-0 border-r border-ink/[0.06] bg-black/10 p-3 sm:block"><p className="eyebrow px-2 py-2">FIELD MANUAL</p>{sections.map(({ id, label, icon: Icon }) => <button key={id} className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] ${section === id ? 'bg-[rgba(var(--accent-rgb),0.1)] accent-text' : 'text-ink/40 hover:bg-ink/[0.035]'}`} onClick={() => setSection(id)}><Icon size={14} />{label}</button>)}</aside>
      <div className="app-scroll min-w-0 flex-1 overflow-y-auto p-5 sm:p-7">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex gap-1 overflow-x-auto sm:hidden">{sections.map((item) => <button key={item.id} className={`shrink-0 rounded-full px-2.5 py-1.5 text-[9px] ${section === item.id ? 'bg-ink/[0.08] text-ink/70' : 'text-ink/30'}`} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>
          {section === 'start' && <section><p className="eyebrow">WELCOME, EXPLORER</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Your guide to NOVA</h2><p className="mt-3 text-xs leading-6 text-ink/45">NOVA is a browser-based desktop environment—not an operating system installed on your computer. It runs alongside Windows in a modern browser and does not change your partitions, bootloader, BIOS, or security settings.</p><div className="mt-6 space-y-3">{[
            ['Launch an app', 'Double-click a desktop icon, use the dock, or open the app launcher from the NOVA logo.'],
            ['Arrange your space', 'Drag a title bar to move a window. Drag any edge or corner to resize. Double-click the title bar to maximize or restore.'],
            ['Find anything', 'Press Ctrl + K to search apps, virtual files, notes, and calendar events.'],
            ['Make it yours', 'Open Settings to switch light/dark mode, change the theme and accent, upload a custom wallpaper, and adjust motion or performance effects.'],
          ].map(([title, text], index) => <div key={title} className="nova-card flex gap-3 p-4"><span className="accent-surface flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold">{index + 1}</span><div><h3 className="text-xs font-semibold text-ink/75">{title}</h3><p className="mt-1.5 text-[11px] leading-5 text-ink/35">{text}</p></div></div>)}</div><button className="nova-button mt-5" onClick={() => openApp('files')}>Explore your virtual files</button></section>}

          {section === 'shortcuts' && <section><p className="eyebrow">FLIGHT CONTROLS</p><h2 className="mt-2 text-xl font-semibold">Keyboard shortcuts</h2><p className="mt-2 text-xs leading-5 text-ink/40">Browser and Windows shortcuts take priority when they conflict. On macOS, use the equivalent available key combination where supported.</p><div className="mt-5 overflow-hidden rounded-xl border border-ink/[0.07]">{shortcuts.map(([keys, action]) => <div key={keys} className="flex items-center gap-4 border-b border-ink/[0.055] bg-ink/[0.02] px-4 py-3 last:border-0"><kbd className="min-w-28 rounded-md border border-ink/10 bg-black/20 px-2 py-1.5 text-center font-mono text-[10px] text-ink/60">{keys}</kbd><span className="text-[11px] text-ink/40">{action}</span></div>)}</div><div className="nova-card mt-5 p-4"><div className="flex items-center gap-2 text-xs font-medium text-ink/65"><Command size={14} className="accent-text" /> Calculator input</div><p className="mt-2 text-[11px] leading-5 text-ink/35">Focus the Calculator and use number keys, operators, Enter, Backspace, and Escape. The % button calculates modulo.</p></div></section>}

          {section === 'storage' && <section><p className="eyebrow">YOUR DATA</p><h2 className="mt-2 text-xl font-semibold">Storage & backups</h2><div className="mt-5 space-y-4 text-[11px] leading-6 text-ink/40"><p><strong className="text-ink/70">IndexedDB</strong> stores structured virtual files, notes, events, NOVA Browser history and bookmarks, and custom wallpaper images. <strong className="text-ink/70">LocalStorage</strong> stores appearance and desktop preferences. Media Player files use temporary object URLs and last only for the current session.</p><p>Browser storage is origin-specific and sandboxed. Clearing site data, using some private-browsing modes, browser policy, or storage pressure can remove it. NOVA cannot guarantee permanent storage.</p><p>Use <strong className="text-ink/70">Settings → Data → Export backup</strong> regularly. The JSON backup contains your virtual files, notes, events, history, bookmarks, and preferences. Custom wallpaper images remain local and are not included. Treat backups like personal data.</p></div><button className="nova-button mt-5" onClick={() => openApp('settings')}>Open data settings</button><div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-[10px] leading-5 text-amber-100/45">Import replaces current NOVA structured data after validation and confirmation. Export a fresh backup first. Imported text is never executed or rendered as HTML.</div></section>}

          {section === 'security' && <section><p className="eyebrow">SAFE BY DESIGN</p><h2 className="mt-2 text-xl font-semibold">Security & browser sandbox</h2><div className="mt-5 space-y-3">{[
            ['Restricted Terminal', 'NOVA Terminal recognizes only its own documented commands. It is not CMD, PowerShell, Bash, or a system shell, and cannot execute user-supplied programs.'],
            ['No code evaluation', 'Calculator expressions are processed by a small arithmetic parser. NOVA does not use eval or the Function constructor for calculations, imports, or commands.'],
            ['Plain-text rendering', 'Notes, virtual files, terminal output, and imported content are rendered as text. NOVA does not inject imported HTML into the page.'],
            ['Limited device access', 'The virtual file system cannot browse your Windows drive. Media and text files are accessed only after you choose them in a file picker.'],
            ['Honest statistics', 'Quick Settings labels CPU, RAM, and GPU values as SIMULATED. Online state and logical CPU thread count are browser-reported, not direct hardware diagnostics.'],
          ].map(([title, text]) => <article key={title} className="nova-card p-4"><h3 className="flex items-center gap-2 text-xs font-semibold text-ink/75"><ShieldCheck size={14} className="text-emerald-300/60" />{title}</h3><p className="mt-2 text-[11px] leading-5 text-ink/35">{text}</p></article>)}</div></section>}

          {section === 'browser' && <section><p className="eyebrow">THE OPEN WEB</p><h2 className="mt-2 text-xl font-semibold">Browser boundaries</h2><p className="mt-3 text-xs leading-6 text-ink/40">NOVA Browser is a navigation interface inside your existing browser. It accepts only HTTP and HTTPS addresses and blocks URLs with embedded credentials. It does not provide a separate browser engine, VPN, proxy, or anonymity.</p><div className="nova-card mt-5 p-4"><h3 className="text-xs font-semibold text-ink/70">Why might a page appear blank?</h3><p className="mt-2 text-[11px] leading-5 text-ink/35">Many sites send X-Frame-Options or Content-Security-Policy headers that prevent embedding. Browser cross-origin rules also limit what NOVA can observe inside a page. Use “Open externally” to visit the site in a normal browser tab.</p></div><div className="nova-card mt-3 p-4"><h3 className="text-xs font-semibold text-ink/70">Navigation & privacy</h3><p className="mt-2 text-[11px] leading-5 text-ink/35">NOVA records addresses you submit in local IndexedDB history. Session tabs are not restored after a reload; bookmarks persist locally and are included in JSON backups. External sites have their own cookies, permissions, network activity, and privacy policies. NOVA cannot inspect or protect you from their content.</p></div><button className="nova-button mt-5" onClick={() => openApp('browser')}>Open NOVA Browser</button></section>}
          <p className="mt-8 border-t border-ink/[0.055] pt-4 text-center text-[9px] text-ink/20">NOVA Web OS 1.0 · Beyond Earth. Beyond Limits.</p>
        </div>
      </div>
    </div>
  );
}
