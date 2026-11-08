# Boot & desktop animation upgrade

- Date: 2026-11-08
- Type: incremental UI/UX enhancement on the existing NOVA Web OS (React 18 + TypeScript + Vite)
- Dependencies added: **none** (Framer Motion 11 and Lucide were already installed)

## 1. Pre-implementation audit

The whole repository was inspected before changes. The existing architecture was preserved:

| Concern | Existing implementation (unchanged) |
| --- | --- |
| Entry point | `src/main.tsx` → `PreferencesProvider` → `LocalizationProvider` → `NotificationProvider` → `App` |
| Root | `src/App.tsx` recovery `ErrorBoundary` → `src/components/DesktopShell.tsx` |
| Routing / apps | No router; one lazy app registry (`src/apps/registry.ts`) and window state in `useWindowManager` |
| State | `PreferencesContext` + sanitized LocalStorage (`src/lib/preferences.ts`); `NotificationContext`; `LaunchContext`; `WindowManagerContext` |
| Data | Local-first IndexedDB (`src/lib/db.ts`, version 3), validated JSON backups, website shortcuts, custom wallpaper blobs |
| Loading | `DesktopShell` owned `entered`; `BootScreen` had a 1.2 s timer; `desktop-enter` CSS keyframe; DB init and shortcut loading happened *after* entry |
| PWA / security | `public/sw.js`, manifest, Vercel CSP/headers, gesture-gated local startup chime |

Baseline verification before changes: `npm run typecheck`, `npm test` (48 files / 152 tests), `npm run build`, and `npm run test:pwa` all passed.

## 2. What changed

### Real initialization controls the loading state

`src/lib/systemInitialization.ts` runs one idempotent pass per page load. A module-level promise keeps React StrictMode, HMR and remounts from duplicating work. Three real tasks run in dependency order:

1. **Initializing NOVA OS** — revalidate stored preferences and wait for the first painted frame.
2. **Loading System Components** — `initializeDatabase()` and read website shortcuts (primed into a small cache so icons do not pop in later).
3. **Preparing Desktop Environment** — resolve/decode a custom wallpaper blob and await font readiness.
4. **System Ready** — published when all tasks settle.

Progress is derived from completed tasks, not timers. Failures are collected and produce a `degraded` state with a safe-mode note; a **3.5 s watchdog** guarantees the desktop is never blocked. `Skip startup` and `Escape` remain immediate escape hatches. No network requests, tracking, canvas loops or polling were added.

`src/hooks/useSystemInitialization.ts` binds the shell to that pass with `useSyncExternalStore`. `src/lib/wallpaperAsset.ts` shares a bounded (2-entry) object-URL cache between the initializer and the shell, so a custom wallpaper is read and decoded once. `src/hooks/useWebsiteShortcuts.ts` now loads during boot and consumes the primed records.

### Cinematic boot screen

`src/components/boot/BootAnimation.tsx` + `boot.css` provide the reusable visuals, and `src/components/BootScreen.tsx` keeps the existing first-run welcome, welcome key, startup sound and skip behavior.

- Deep cosmic dark gradients, vignette and a faint grid, with the custom wallpaper dimmed to 7% for continuity.
- Glowing NOVA logo, rotating orbit ring and light sweep.
- 16 deterministic CSS-only particles (transform/opacity, no canvas, no RAF loop), reduced on small screens and removed entirely under reduced motion.
- Glassmorphic panel, gradient progress bar animated with `transform: scaleX`, shimmer and all four boot messages with a live status region.
- Framer Motion is used only for the short logo reveal, progress settle, welcome transition and boot-layer crossfade.

### Desktop reveal

`src/styles/desktop-reveal.css` animates `.nova-wallpaper`, staggered `.desktop-icon` elements (bounded `--reveal-delay`), the taskbar sliding up, the system tray, dock and desktop hint. A `data-desktop-reveal="playing"` attribute is removed after the last animation (1.6 s ceiling), so no element is ever left hidden. The old root-level `desktop-enter` keyframe was removed to avoid double fades and transform-induced flicker.

The desktop mounts underneath the exiting boot layer via `AnimatePresence`, producing a crossfade rather than a hard cut. The shared `LaunchProvider` / `WindowManagerProvider` structure, keyboard shortcuts, context menus, app windows, dock, taskbar and PWA manager are untouched.

### Session, refresh and preview safety

- `src/lib/boot.ts` stores a per-tab `sessionStorage` marker when the desktop is entered. A refresh, bfcache restore, SPA navigation or HMR remount returns straight to the desktop; a cold start (new tab) shows the boot. The real boot layer is rendered only while `entered === false`.
- `popstate` and `pageshow` dismiss any open preview.
- Settings → **System → Startup → Preview boot animation** dispatches a local event. `src/components/boot/BootPreview.tsx` shows a bounded, focus-managed dialog with a visual-only replay: no initialization, no shell remount, no app-state changes. It closes with Escape, the close button, a backdrop click or a 6 s auto-dismiss. An explicit preview plays even when the boot animation switch is off, so users can preview before enabling it; reduced motion still forces a static `System Ready` frame.
- Settings → **Show welcome next launch** also clears the session marker so the welcome path still works on reload in the same tab.

### Settings and persistence

The existing preference architecture was extended by one boolean, `desktopAnimation` (default `true`, sanitized with the other booleans, automatically compatible with version 1 backups through `sanitizePreferences`):

| Setting | Preference |
| --- | --- |
| Boot animation | `startupAnimation` (existing, relabeled) |
| Desktop animation | `desktopAnimation` (new) |
| Reduce motion | `reduceMotion` (existing) |
| Preview boot animation | transient action, no stored state |

`src/hooks/useNovaMotion.ts` is the single source of truth: OS `prefers-reduced-motion` wins, then the NOVA reduced-motion setting, then the individual switches. Reduced motion or disabled animations enter the desktop immediately with **no loading wait**. Performance mode also drops decorative effects and blur.

## 3. Animation timeline

The requested 0–6 s timeline is implemented as a **maximum pacing envelope**, not a fake loading delay:

| Window | What happens |
| --- | --- |
| 0–1 s | Logo reveal (0.9 s Framer transition) while real initialization starts |
| 1–3 s | Real tasks drive the progress bar and stage messages; fast systems finish here |
| 3–4 s | 3.5 s watchdog ceiling, `System Ready`, progress settle and 0.45 s boot crossfade |
| 4–6 s | Desktop reveal: wallpaper fade, staggered icons, taskbar/dock/widget slide (max 1.6 s) |

If initialization is already ready, the boot collapses to the logo reveal and crossfade — there is no staged `setTimeout` padding. The watchdog is the only timer that can end the boot early, and it exists purely so a hung IndexedDB or image decode cannot block the desktop.

## 4. Verification

Run in this environment after the change:

- `npm run typecheck` — passed
- `npm test` — **53 test files, 185 tests passed** (including the whole-app Neon glow visual-style preference, settings toggle, boot/preview/desktop `data-neon` propagation and preference migration)
- `npm run build` — passed (Vite still reports the pre-existing large lazy Writer/PDF chunks)
- `npm run test:pwa` — passed
- `git diff --check` — passed

Covered scenarios: first launch, browser refresh / returning session, first-run welcome, desktop application opening, mobile/tablet CSS breakpoints, reduced motion, disabled animations, initialization failures and watchdog timeout, duplicate initialization, preference migration, custom wallpaper cache, preview dismissal, and all pre-existing app/settings/backup contracts.

No local browser executable was available for visual or screen-reader testing in this environment; responsive and reduced-motion behavior is covered by CSS and unit/integration tests, not by a real-device claim.
