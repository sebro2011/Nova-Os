# Nova-Os

**NOVA Web OS — Beyond Earth. Beyond Limits.**

A lightweight, responsive, local-first desktop environment that runs entirely in a modern browser. Built with React, TypeScript, Vite, Tailwind CSS, Lucide icons, and selectively used Framer Motion. No account, paid API, or backend is required for core features.

> NOVA is a web application, not an installed operating system. It does not modify Windows partitions, the bootloader, BIOS, or security settings.

## Features

- Animated boot and first-run welcome experience
- Cosmic Dark and bright light modes with Liquid Glass-inspired surfaces, three themes, three accents, three built-in wallpapers, and custom image uploads
- Desktop icons, app launcher, dock, taskbar, system tray, clock, quick settings, and notification center
- Multi-window manager with focus, drag, eight-direction resize, minimize, maximize/restore, and close
- **Mobile phone layout:** edge-to-edge app windows, portrait/landscape adaptation, safe-area support, larger touch controls, mobile browser menus, and touch-friendly Files navigation
- Global search across apps, virtual files, notes, and events (`Ctrl + K`)
- **Files:** virtual folders and plain-text files, rename, safe Trash/restore, permanent-delete confirmation, text import, and download
- **NOVA Browser:** up to eight session tabs, persistent bookmarks, HTTP/HTTPS navigation, search, back/forward, clearable local history, sandboxed frames, and a dedicated external-only screen for Google Search
- **Terminal:** a restricted custom command interpreter—not a system shell
- **Notes:** local notes with debounced autosave
- **Calculator:** keyboard-friendly arithmetic using a dedicated parser, with no `eval`
- **Calendar:** six-week month view and local event management
- **Media Player:** local audio/video playback with a session-only queue
- **App Center:** launch and pin built-in apps; no executable installation
- **Settings:** light/dark mode, themes, custom locally stored wallpapers, accessibility, performance mode, browser storage estimates, and data controls
- Validated JSON backup import with preview/confirmation and full JSON export
- Keyboard shortcuts, Help Center, responsive layouts, reduced-motion support, and storage error states

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 18, TypeScript, Vite 8 |
| Styling | Tailwind CSS 3, custom CSS design tokens |
| Icons | Lucide React |
| Motion | Framer Motion, limited to shell/windows/overlays |
| Structured data | Native IndexedDB (`nova-web-os`) |
| Preferences | LocalStorage (`nova.preferences.v1`) |
| Tests | Vitest, jsdom, Testing Library setup |
| Deployment | Static Vite output on Vercel |

## Local setup

### Requirements

- Node.js 22.12 or newer (current Node 22 LTS recommended)
- npm 10 or newer
- A current Chrome, Edge, Firefox, Safari, or similar modern browser on desktop or mobile

### Install and run

```bash
git clone https://github.com/sebro2011/Nova-Os.git
cd Nova-Os
npm ci
npm run dev
```

Vite listens on `0.0.0.0:5173`. Open the local URL printed by Vite. Do not commit `.env` files; NOVA core features do not require environment variables or secrets.

### Production build

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

The deployable static site is generated in `dist/`.

## Project structure

```text
Nova-Os/
├── public/
│   └── favicon.svg
├── src/
│   ├── apps/                 # Lazy-loaded app windows and app registry
│   │   ├── FilesApp.tsx
│   │   ├── BrowserApp.tsx
│   │   ├── TerminalApp.tsx
│   │   ├── NotesApp.tsx
│   │   ├── CalculatorApp.tsx
│   │   ├── CalendarApp.tsx
│   │   ├── MediaApp.tsx
│   │   ├── SettingsApp.tsx
│   │   ├── AppCenterApp.tsx
│   │   └── HelpApp.tsx
│   ├── components/           # Boot screen, shell, windows, dock, menus, search
│   ├── context/              # Preferences, notifications, app launching
│   ├── hooks/                # Window-manager state and viewport fitting
│   ├── lib/                  # IndexedDB, validation, parsers, utilities, tests
│   ├── test/                 # Vitest setup
│   ├── App.tsx               # Recovery error boundary
│   ├── index.css             # Design system and responsive/reduced-motion rules
│   ├── main.tsx              # Application entry point
│   └── types.ts              # Shared data and window contracts
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig*.json
├── vite.config.ts
└── vercel.json
```

## Phone and touch use

- Below 768 px—and on coarse-pointer phones in short landscape orientation—apps use the full workspace instead of floating desktop windows. Rotation and media-query changes are handled without resetting app state.
- Tap a desktop icon once to open it. In Files, tap an item once to select it and tap it again to open it; mobile Places navigation keeps Home, All files, and Trash accessible.
- Use an app's minimize control to return to the desktop. The phone dock prioritizes running apps and shows up to four alongside the launcher; every app remains available through the launcher.
- NOVA Browser uses a compact address/toolbar layout. Its **More** menu retains Home, Bookmarks, and **Open in a new browser tab** actions on narrow screens.
- Safe-area insets protect controls from notches and home indicators. Dynamic viewport units, scrollable overlays, 44 px coarse-pointer controls, and 16 px phone form fields improve keyboard and touch usability.
- Desktop-sized screens retain the original movable, resizable, multi-window interface.

Mobile browser chrome and virtual keyboards still reduce the available workspace. Add-to-home-screen behavior is controlled by the host browser; NOVA does not include a native mobile package or an offline service worker.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + K` | Toggle global search |
| `Ctrl + Alt + T` | Open restricted Terminal |
| `Alt + M` | Minimize active window |
| `Alt + W` | Close active window |
| `F1` | Open Help Center |
| `Escape` | Close menus and overlays |
| `Enter` | Open a focused desktop item or search result |

The browser or Windows may reserve some key combinations. Calculator also accepts numbers, arithmetic operators, Enter, Backspace, and Escape while focused.

## Data model and backups

IndexedDB contains these object stores:

- `files`: virtual file/folder records and Trash metadata
- `notes`: note title/content/timestamps
- `events`: local calendar events
- `history`: addresses explicitly submitted in NOVA Browser
- `bookmarks`: persistent NOVA Browser bookmarks
- `wallpapers`: user-uploaded PNG, JPEG, and WebP image blobs
- `meta`: database initialization metadata

Preferences are stored separately in LocalStorage. Media Player uses temporary object URLs; its queue is **not persisted**.

Use **Settings → Data → Export backup** regularly. Backups are unencrypted JSON and may contain personal notes, events, file contents, browsing addresses, and bookmarks. Import is limited to 8 MB, validates the complete schema and relationships, reconstructs plain objects, shows a preview, and requires confirmation before replacing current data. Custom wallpaper image blobs are **not** included in JSON backups and remain on the current browser origin.

## Security model

- No `eval`, `Function` constructor, arbitrary JavaScript execution, or shell execution
- Terminal commands are handled by a fixed whitelist; shell-looking text is inert
- Calculator uses a recursive-descent arithmetic parser
- Browser navigation permits only HTTP/HTTPS and rejects embedded credentials
- Imported notes/files are rendered as text, never as injected HTML
- Backup imports validate types, lengths, IDs, dates, URLs, folder relationships, and collection limits
- Virtual Files cannot browse or modify the Windows file system; users must explicitly choose local text/media/wallpaper files
- Wallpaper uploads accept only decodable PNG, JPEG, or WebP images up to 10 MB and 40 megapixels; SVG and animated GIF files are rejected
- Vercel headers include CSP, `nosniff`, frame restrictions, referrer policy, and a restrictive permissions policy
- Quick Settings CPU/RAM/GPU figures are visibly labeled **SIMULATED**. Online status and logical CPU thread count are browser-reported

No application is automatically secure against malicious browser extensions, a compromised browser/device, or unsafe content opened on external sites. Do not store secrets in NOVA or its backups.

## Performance and accessibility

- App windows are lazy-loaded into separate chunks
- Static CSS wallpapers avoid continuous canvas/WebGL work
- Framer Motion is limited to short shell transitions
- Performance mode disables backdrop blur/transparency compositing
- Reduced motion respects both the operating system preference and NOVA settings
- Semantic controls, visible focus indicators, labels, keyboard navigation, and status announcements are included
- Responsive layouts adapt windows, navigation, app sidebars, and dialogs for smaller screens
- Phone windows remove unnecessary drag/resize gestures and backdrop blur; the dock, desktop icons, panels, and browser controls use touch-specific layouts
- The browser theme-color metadata follows NOVA's light/dark preference for a more consistent mobile browser frame

For the target Windows 10 PC (Intel Core i5-3330, 8 GB RAM, GTX 960 2 GB), use a current hardware-accelerated browser and enable **Performance mode** if transparency feels expensive. Actual performance depends on browser version, extensions, open tabs, and the number/size of open windows and media files.

## Verification

Executed for the current implementation:

- `npm run typecheck` — passed
- `npm test` — **11 test files, 35 tests passed** (including Browser external-only/embedding, responsive window-frame, media-query, window-manager, preference-migration, and backup-validation regressions)
- `npm run build` — passed; static output generated successfully
- `npm audit` — **0 dependency vulnerabilities reported** after upgrading to Vite 8.3.5 and Vitest 5.0.5
- Source scan — no dangerous HTML injection, `eval`, `Function` constructor, or shell-execution APIs in application source

These results describe the checks actually run in the implementation environment, not a guarantee for every browser or device. Run the commands again after changes.

## Known limitations

- Browser storage is origin-specific and can be cleared by site-data controls, private browsing behavior, browser policy, or storage pressure. Persistent-storage requests are browser-decided and do not replace backups.
- NOVA Browser is an interface inside the host browser, not a separate engine, VPN, or proxy. Many websites refuse framed embedding through `X-Frame-Options` or CSP. Google Search uses a dedicated external-only screen instead of rendering its blocked frame; use **Open externally** to continue in a normal browser tab. Other sites may also require external opening.
- Cross-origin browser rules prevent NOVA from reliably tracking navigation that occurs inside a framed site. Back/forward primarily covers addresses submitted through NOVA. Browser tabs are session-only and are not restored after a reload.
- Custom wallpaper images are stored only in IndexedDB and are not included in JSON backups.
- External pages have their own cookies, permissions, network requests, and privacy policies.
- Media codec support depends on the browser. Media playlists last only for the current session and individual selections are limited to 500 MB.
- The terminal is intentionally simulated and restricted; it cannot run CMD, PowerShell, Bash, packages, or user code.
- Hardware performance gauges are simulated, not genuine Task Manager telemetry.
- Notifications are session-only; there is no push service, cloud sync, account system, or multi-device synchronization.
- NOVA is not a native Android/iOS package and has no offline service worker. Add-to-home-screen and standalone-display behavior varies by browser.
- One window instance per built-in app is currently used; multiple different apps can be arranged simultaneously.

## Deploy to Vercel

The included `vercel.json` configures the Vite build, SPA fallback, and security headers.

### Vercel dashboard

1. Push this branch/repository to GitHub.
2. In Vercel, choose **Add New → Project** and import `sebro2011/Nova-Os`.
3. Vercel should detect **Vite**. Confirm:
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: `dist`
4. No environment variables are required.
5. Deploy and test the production URL, including reloads and backup export/import.

### Vercel CLI (optional)

Use your own authenticated Vercel CLI session; never place tokens in source control.

```bash
npx vercel
npx vercel --prod
```

Using Vercel is optional and external to the core app. A production deployment creates a different storage origin from local development, so browser data does not automatically transfer—export a backup first and import it on the deployed origin if desired.
