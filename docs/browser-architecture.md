# NOVA Browser compatibility and architecture audit

Audit date: 2026-11-01

## Scope

This review covers `BrowserApp.tsx`, browser helpers/tests, IndexedDB-backed history and bookmarks, launch state, the production service worker, CSP/security headers, and Vercel deployment. NOVA remains a React 18, TypeScript, Vite, and Tailwind web application. No Electron migration, external proxy, or credential-bearing backend is included.

## 1. Current browser limitations

NOVA Browser is browser chrome inside the host browser, not a separate browser engine. It supports up to eight session tabs, NOVA-managed back/forward stacks, HTTP/HTTPS address normalization, Google search submission, local history, persistent bookmarks, reload, home, external opening, and official YouTube video embeds.

Important boundaries remain:

- Cross-origin policy prevents NOVA from reading an embedded page's response status, response headers, title, current in-frame URL, DOM, or authentication state.
- An iframe `load` event is not proof that remote content rendered successfully. Browser-generated block/error pages can also produce load-related behavior.
- NOVA-managed back/forward covers addresses submitted through NOVA. It cannot faithfully reproduce arbitrary navigation that occurs inside a remote frame.
- Session tabs are not restored after an application reload. Only one remote frame is rendered at a time, so switching tabs does not guarantee preservation of a remote page's ephemeral in-frame state.
- Public availability does not imply embed permission, and embedding does not bypass sign-in, CAPTCHA, region restrictions, DRM, cookies, or site-specific API requirements.

## 2. Root-cause classification

| Category | Actual effect | NOVA response |
| --- | --- | --- |
| Iframe restrictions | A site may refuse framing or require a specially supported embed endpoint. | Attempt ordinary HTTP/HTTPS frames only when permitted; use an official adapter where available. |
| `X-Frame-Options` | `DENY` or an incompatible `SAMEORIGIN` policy prevents rendering in NOVA's cross-origin frame. | Show an external-only explanation for known policies; otherwise provide compatibility help without claiming a cause that cannot be inspected. |
| CSP `frame-ancestors` | The destination controls which ancestors may frame it. NOVA cannot override this response header. | Respect the destination and offer external navigation. |
| NOVA CSP `frame-src` | NOVA controls which frame sources it will attempt. Current `frame-src http: https:` permits web frames; HTTPS mixed-content rules still apply. | Keep the deliberate policy. Do not broaden script, connect, object, or top-navigation privileges. |
| CORS | CORS normally governs cross-origin data/API access, not whether an ordinary iframe navigation may be attempted. The same-origin policy separately blocks DOM inspection. | Do not label blank frames as CORS failures. Explain the distinction in the compatibility panel. |
| Authentication | SameSite/third-party-cookie rules, SSO, CAPTCHA, age checks, and account permissions can differ between framed and normal navigation. | Never request credentials or bypass the flow. Open the canonical address externally. |
| Unsupported or restricted APIs | Fullscreen, downloads, clipboard, DRM, camera, microphone, geolocation, and storage behavior depend on browser support, permissions policy, sandbox flags, and user activation. | Enable fullscreen only through supported APIs. Keep camera, microphone, and geolocation disabled at NOVA's deployment boundary. |
| Mixed content | An HTTPS NOVA deployment cannot embed active HTTP content. | Preserve the address and require external navigation rather than weakening HTTPS protections. |
| Network/offline | `navigator.onLine === false` is a useful local offline signal but says nothing definitive about a remote server. | Show an honest offline page and do not claim that the remote site is down. |

NOVA's own `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` protect NOVA from being framed by unrelated sites; they do not prevent NOVA from framing other sites. The production worker explicitly ignores cross-origin requests and is not a proxy.

## 3. Recommended architecture

### A. Existing web deployment — primary target

Keep the Vercel-hosted React/Vite application.

- Validate and canonicalize only HTTP/HTTPS addresses; reject credentials and active-content schemes.
- Use sandboxed frames for ordinary sites and official embed endpoints for supported adapters.
- Detect only restrictions that are known locally, such as mixed content, NOVA's own origin, and explicitly maintained destination-policy adapters.
- For unknown cross-origin failures, say that NOVA cannot verify the cause. Never claim embedded success solely from `onLoad`.
- Preserve the canonical address and NOVA tab/history context when opening externally.
- Use `window.open` only from explicit user actions with `noopener,noreferrer`.
- Keep external sites out of the app-shell service-worker cache.

### B. Optional Chromium desktop shell — evaluation only

Electron is the most direct optional target when a consistent Chromium runtime is required. A system-webview toolkit would have different engine and API behavior and would not provide the same Chromium guarantee.

A future desktop implementation should be additive, not a replacement for the web app:

- Reuse the React Browser chrome in a hardened renderer.
- Give each browser tab a separate top-level `WebContentsView`; do not render arbitrary sites inside the privileged NOVA renderer.
- Set `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`; keep `webSecurity` enabled.
- Expose only typed, allowlisted IPC navigation commands. Do not expose Node, shell, arbitrary file, or general IPC access to remote content.
- Validate `will-navigate`, `will-redirect`, and `setWindowOpenHandler` decisions. Deny unexpected window creation and require explicit external-navigation handling.
- Deny permissions by default and add narrowly scoped, user-mediated exceptions only after review.
- Define session partitioning, cookie/cache retention, download handling, updates, code signing, installers, crash handling, and Windows/macOS/Linux CI before implementation.

Top-level `WebContentsView` navigation avoids iframe-only `X-Frame-Options`/`frame-ancestors` restrictions. It does **not** bypass CORS, authentication, CAPTCHA, DRM, paywalls, region rules, or a site's own security controls.

## 4. Required code changes

The current web phase implements:

- Stop and reload controls that preserve the active address and NOVA history stack.
- Honest stopped and offline pages plus existing validation and known-policy external-only pages.
- Known GitHub and non-video YouTube external-only handling while retaining official YouTube video adaptation.
- Same-origin frame refusal to prevent recursive NOVA frames and protect the remote-content sandbox boundary.
- A correct HTTPS/HTTP address indicator instead of showing a secure lock for every address.
- User-initiated fullscreen through the supported Fullscreen API, plus iframe fullscreen permission where allowed.
- A compatibility/privacy panel that separates framing policy, CORS, authentication, and restricted APIs.
- Regression tests for these behaviors without changing bookmark/history or backup schemas.

No `vercel.json` CSP relaxation is required for this phase.

## 5. Security implications

- More compatibility must not mean weaker isolation. Keep sandboxed remote content, strict scheme validation, and explicit external navigation.
- Do not frame NOVA's own origin with both `allow-scripts` and `allow-same-origin`; recursive same-origin active content would weaken the intended sandbox boundary.
- Fullscreen requires user activation and can be visually immersive. NOVA labels its own fullscreen action and relies on the host browser's normal exit behavior.
- External pages retain their own cookies, network activity, permissions, and privacy policies. NOVA is not a VPN, anonymity service, or safety filter.
- An unrestricted proxy could expose internal services, authentication tokens, user data, and abuse infrastructure while undermining destination security policies. It is explicitly excluded.
- Electron would increase the trusted computing base and release/security obligations. It requires a separate approval and threat-model review.

## 6. Phased implementation plan

1. **Audit and web safety baseline — complete.** Inventory navigation/state/CSP/service-worker behavior; preserve existing data and applications.
2. **Web Browser upgrade — implemented in this branch.** Add the controls, honest states, compatibility UI, policy adapters, fullscreen support, and regression coverage listed above.
3. **Real-browser compatibility QA — pending a browser/device.** Test current Chrome/Edge and Firefox, with Safari/mobile where available. Record embedded versus external-only results and browser versions; do not infer them from HTTP fetches.
4. **Optional Electron proof of concept — approval required.** Present a concrete renderer/main/IPC threat model, packaging/update plan, and data-migration strategy before adding dependencies or code.
5. **Deployment review.** Run CI, inspect the Vercel preview, and promote only after approval. Production remains separate from preview validation.

## Site-check record for this audit

These checks distinguish source behavior and remote content availability from real embedded rendering. No local Chrome, Chromium, Firefox, Playwright, Puppeteer, or Electron executable was available.

| Site | What was actually checked | Embedded result |
| --- | --- | --- |
| Google Search | Search URL normalization and external-only regression tests passed. The page-fetch tool returned HTTP 500. | External-only by NOVA policy adapter; no live embed claim. |
| Wikipedia | `https://www.wikipedia.org/` content was fetched successfully. | NOVA attempts a sandboxed frame; real rendering not browser-tested. |
| YouTube | The public watch page and corresponding `youtube-nocookie.com` player endpoint were fetched successfully. | Supported video URLs use the official player; playback not browser-tested. Other main-site pages are external-only. |
| GitHub | The NOVA repository page was fetched successfully. | Main-site pages use NOVA's known-policy external-only screen; no live header/embed claim. |
| MDN, NASA, Example Domain | Public content was fetched successfully. | NOVA attempts sandboxed frames; real rendering not browser-tested. |
