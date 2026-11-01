# NOVA Office Suite — architecture and implementation plan

- Date: 2026-11-01
- Branch: `arena/d1410e3c-nova-os` (fixed by the session; no additional branch was created)

## Repository audit

- Existing architecture retained: React 18, TypeScript, Vite, Tailwind, Lucide, lazy app windows, and the existing window manager.
- Audited `package.json`, registry, `DesktopShell`, `WindowFrame`, `useWindowManager`, App Center, Files, IndexedDB, backups, preferences, and PWA/deployment configuration.
- IndexedDB is `nova-web-os` version 3 with `files`, `notes`, `events`, `history`, `bookmarks`, `websites`, `wallpapers`, and `meta` stores.
- Version 1 backups already include `files`; website shortcuts are optional for backward compatibility.
- Files provides canonical rename, Trash/restore, permanent-delete confirmation, import, and plain-text editing. Office documents will not receive duplicate shadow records.
- The existing launch intent already supports `recordId`, making it suitable for opening Office files from Files and Office Hub.
- The service worker caches only same-origin static resources and never reads IndexedDB/localStorage. Private Office documents must remain outside Cache Storage.
- No existing localization system was found. A shared NOVA locale preference/provider is required rather than an Office-only language store.
- Baseline after restoring snapshot-excluded dependencies: TypeScript passed, 24 test files / 88 tests passed, production build and PWA validation passed, and npm audit reported 0 vulnerabilities.

## Canonical file architecture

Office uses the existing `files` object store and `FileNode` records:

| Kind | Native MIME | Extension | Payload |
| --- | --- | --- | --- |
| Writer | `application/x-nova-writer+json` | `.nwdoc` | Validated, versioned structured JSON |
| Sheets | `application/x-nova-sheets+json` | `.nwsheet` | Validated sparse workbook JSON |
| Slides | `application/x-nova-slides+json` | `.nwslides` | Validated slide/object JSON |
| PDF | `application/pdf` | `.pdf` | Bounded local PDF data URL after signature validation |

This preserves Files rename/copy/Trash behavior, backup compatibility, global search, and offline record access without a database reset or new duplicate document store. Large binary content stays in IndexedDB, not localStorage. Backup size limits remain enforced and PDF/native Office payload validation is added explicitly.

## Dependency and licensing report

| Selection | License | Decision and performance posture |
| --- | --- | --- |
| Tiptap 3.32.2 | MIT | React 18-compatible structured Writer editor; lazy app chunk. |
| Mammoth 1.13.0 | BSD-2-Clause | DOCX-to-intermediate content; schema filtering before editor use; dynamic import. |
| docx 9.15.1 | MIT | DOCX generation from the structured Writer model; dynamic import. |
| fflate 0.8.3 | MIT | Bounded streaming DOCX/XLSX OOXML ZIP processing without ExcelJS legacy dependencies. |
| PptxGenJS 4.0.1 | MIT | PPTX generation from the internal slide model; dynamic import. |
| PDF.js 6.4.299 | Apache-2.0 | Local PDF parsing/rendering; lazy viewer and same-origin worker. |
| jsPDF 4.2.1 + html2canvas 1.4.1 | MIT | Lazy visual PDF export; browser print remains available. |
| HyperFormula | GPL-3.0-only | Not selected; licensing posture is unsuitable for this repository. |
| Univer | Apache-2.0 | Not selected for the MVP; a complete spreadsheet runtime is excessive for low-end targets. |
| FortuneSheet | — | Not selected; npm package is unpublished. |
| SheetJS `xlsx` | Apache-2.0 | Not selected; avoided the stale/vulnerable npm release line. |
| ExcelJS | MIT | Installed during evaluation then removed after npm audit reported vulnerable legacy transitive dependencies. |

The initial candidate tree reported 11 vulnerabilities. ExcelJS was removed, fflate replaced it, and a patched `image-size` 2.0.4 override was applied for PptxGenJS. The revised tree reported 0 vulnerabilities. PPTX export must be exercised in tests to verify the override rather than relying on metadata alone.

## Implementation phases

1. **Audit and architecture:** complete; baseline recorded.
2. **Office core:** canonical models, validation, factories, storage events, autosave, history, tests.
3. **Office Hub:** create/open/search/filter/recent/templates/import and app shortcuts.
4. **Writer MVP:** structured rich editing, toolbar, find/replace, word count, page controls, autosave, TXT/DOCX/native/PDF paths with explicit compatibility notices.
5. **Sheets MVP:** virtualized sparse grid, selection/formula bar, formatting, rows/columns, requested functions/references, sorting/filtering, sheets, charts, history, autosave, CSV/XLSX/native paths.
6. **Slides MVP:** thumbnails, structured text/image/shape objects, positioning/resizing, themes/layouts, duplicate/reorder/delete, presentation mode, PPTX/PDF paths.
7. **PDF:** local viewer, pages/zoom/search/fullscreen/print/download and responsive controls.
8. **Integration:** app registry, Files open/import/icons, global search, App Center, locale preference/provider.
9. **Hardening:** bounded imports, schema validation, lazy converters, event cleanup, offline and low-end review.
10. **Verification/release:** focused tests after each phase, then full TypeScript, tests, migration/backup, format round trips, build, PWA, audit, and production HTTP checks.

## Compatibility boundaries to preserve in the UI and final report

- NOVA Office is not Microsoft 365 and does not claim complete DOCX/XLSX/PPTX/PDF compatibility.
- Macros, embedded scripts, remote images, external workbook connections, and arbitrary HTML are not executed.
- Unsupported DOCX/XLSX formatting must produce visible warnings rather than silent claims of fidelity.
- PDF export is visual/raster-based and is not a claim of accessible tagged-PDF generation.
- Spreadsheet formulas are limited to the documented parser and requested functions.
- Offline editing requires the relevant app/converter chunks to have been loaded once; private records remain in IndexedDB.

## Writer-phase implementation evidence

- A shared preference-backed English/Sinhala/Tamil provider now supplies typed messages, date/number formatting, document language metadata, and a Settings selector. It is shared NOVA infrastructure, not an Office-only locale store.
- Writer is a real lazy registry app. Files opens native Writer records through `recordId` launch intents and refreshes after Office file events. Repeated automatic untitled names receive numeric suffixes; explicit naming conflicts remain errors.
- The editor includes rich text, fonts/colors/sizes, headings, alignment, lists, links, validated local images, tables, undo/redo, find/replace, word/character counts, page size/margins, headers/footers, page-number settings, native/TXT/DOCX export, bounded raster PDF export, and sandboxed print.
- Native serialization now validates before save/export. PNG/JPEG/WebP checks include actual signatures and bounded dimensions/pixel counts. OOXML extraction registers a streaming DEFLATE decoder, selects only required entries, and enforces declared and actual decompressed budgets.
- DOCX import exposes a read-only verified ZIP adapter to Mammoth, disables external file access, sanitizes intermediate HTML, preserves readable text where formatting is unsupported, and surfaces compatibility warnings.
- Executed DOCX evidence: generated a package containing formatted Unicode text, lists, a table, a link, and a local PNG; inspected its XML, external relationship, image payload, and PAGE field; then re-imported it through Mammoth and verified supported content. This passed.
- Executed Writer-phase verification: TypeScript passed; 34 test files / 111 tests passed; production build passed; PWA validation passed; `git diff --check` passed. Vite reported large lazy Writer and PDF chunks, which remain separate from initial desktop startup.
- Not yet executed: real-browser visual layout, canvas PDF rendering, print-dialog, screen-reader, mobile-device, or manual Microsoft Word/LibreOffice QA. PDF export and print are implemented but are not claimed as visually verified by jsdom tests.
