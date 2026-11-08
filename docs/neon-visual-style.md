# Neon glow visual style

A whole-app, reversible visual layer for NOVA Web OS. It changes **appearance only** —
no application logic, data, storage layout, routes, or dependencies were changed.

## What changed

The existing cosmic-dark design is retained and intensified with neon light:

| Area | Neon treatment |
| --- | --- |
| Boot screen | Deeper nebula, brighter accent grid, glowing particles, larger halo/ring/logo, luminous title, progress glow and active/completed stage colours |
| Boot preview | Same neon boot layer inside the Settings dialog; carries the user's accent even though it renders outside `.nova-root` |
| Desktop wallpaper | A static multi-radial neon wash, a thin glowing horizon line and one slow compositor-only drift; hidden on phones, in performance mode, high contrast and reduced motion |
| Shell / windows | Deeper `--page`, `--glass`, `--window-rgb` and `--line` tokens; accent-tinted glass, focused-window rim light, titlebar sheen, topbar/dock edge glow |
| Shared components | `glass-panel`, `nova-card`, `nova-button`, `icon-button`, `nova-input`, `accent-surface`, `accent-text`, `eyebrow`, `nova-logo-mark`, focus rings and toggles |
| Desktop icons / dock | Glowing icon tiles with a small lift on hover, brighter active/running dock indicators |
| Office apps | Header/status bar accent lines, glowing primary buttons, active tools, hub cards and dialogs |
| Settings | New **Appearance → Visual style → Neon glow** switch |

Existing theme (`cosmic` / `midnight` / `nebula`), accent (`blue` / `violet` / `cyan`),
light mode and glass-intensity choices continue to work; the neon layer reads the same
`--accent-rgb` and surface variables, so every combination stays coherent. Light mode
gets a restrained accent glow rather than dark surfaces.

## How it is wired

- `NovaPreferences.neonGlow` (default `true`) in `src/types.ts` and `src/lib/preferences.ts`.
  The sanitizer defaults missing or invalid values to `true`, so existing LocalStorage
  settings migrate without a version bump.
- `useNovaMotion()` exposes `neonGlow`; `DesktopShell` puts `data-neon` on the desktop
  root and boot wrapper, and `BootScreen` / `BootAnimation` put it on their own roots so
  the standalone boot layer and the Settings preview are covered too.
- `src/styles/neon.css` (imported once from `src/main.tsx`) and the neon section of
  `src/components/boot/boot.css` contain **all** visual rules. Every selector is gated
  on `[data-neon='true']`, so switching the preference off restores the previous look
  exactly — no inline styles or imperative class changes.
- `DesktopWallpaper` renders one decorative `<div class="nova-wallpaper-neon" aria-hidden>`;
  it is `display: none` unless neon is on.

## Safety and performance

- CSS only: no new dependency, timer, canvas/WebGL, `fetch`, analytics or network call.
- The only animation is one `transform`/`opacity` drift on a single composited layer.
  It is disabled by `prefers-reduced-motion`, NOVA reduced motion, performance mode,
  high contrast, and phone layouts (CSS hides the layer's pseudo-elements).
- All glows are suppressed in performance mode and high contrast via `box-shadow: none`,
  keeping text contrast and focus indicators intact. Light mode surface/text colours
  are unchanged, so readability is preserved.
- The switch follows the existing LocalStorage preference architecture, including
  version 1 backups (preferences are not part of JSON backups).

## Verification

Run after the change:

- `npm run typecheck` — passed
- `npm test` — **53 test files, 185 tests passed**
- `npm run build` — passed (Vite still reports the pre-existing large lazy Writer/PDF chunks)
- `npm run test:pwa` — passed
- `git diff --check` — passed
- `npm audit --audit-level=high` — 0 vulnerabilities

New tests cover: preference default/migration, the Appearance toggle and persistence,
`data-neon` on boot / boot preview / desktop in both states, and forwarding the setting
into the preview. No local browser executable was available, so the visual result,
screen-reader behaviour and real-device performance are CSS/test-based rather than
real-browser verified.

## Turning it off

**Settings → Appearance → Visual style → Neon glow**. The choice is saved immediately
and applies to every screen, including the boot animation and its preview.
