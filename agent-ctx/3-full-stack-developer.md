# Task 3 — frontend (full-stack-developer)

## What I built
The full ScholarSift frontend on the single user-visible route `src/app/page.tsx`,
split into modular components under `src/components/` (NOT under `src/components/ui/`,
which is reserved for shadcn primitives).

## Files created
- `src/lib/format.ts` — number / authors / year / relative-time / DOI formatters
- `src/lib/query-keys.ts` — centralised React Query keys
- `src/lib/api-client.ts` — browser-safe fetch helpers for every documented endpoint
  (search, paper detail, collections CRUD, saved-paper CRUD, history, export)
- `src/components/providers.tsx` — QueryClientProvider + next-themes ThemeProvider + Sonner Toaster
- `src/components/theme-toggle.tsx`
- `src/components/source-badge.tsx` — S2 emerald / OA amber / CR teal
- `src/components/app-header.tsx` — sticky header with Saved badge + theme + info links
- `src/components/app-footer.tsx` — sticky footer with source links + clear-history action
- `src/components/search-bar.tsx` — debounced (400ms) input + example-query chips
- `src/components/filter-sidebar.tsx` — works inline (desktop) and inside a Sheet (mobile)
- `src/components/save-paper-dialog.tsx` — Popover listing collections + inline create form
- `src/components/columns.tsx` — react-table ColumnDef factory
- `src/components/results-table.tsx` — centerpiece: sticky Title column, column-visibility dropdown,
  skeleton loading, empty/error states, source-coverage chips, CSV/BibTeX export
- `src/components/paper-detail-drawer.tsx` — wide Sheet with abstract, TL;DR, fields, concepts,
  References / Cited-by tabs (click to navigate), notes textarea → save dialog
- `src/components/collections-sheet.tsx` — Saved sheet (list + create + delete)
- `src/components/collection-detail-panel.tsx` — read-only saved-papers table with remove + export
- `src/app/page.tsx` — composition root

## Files modified
- `src/app/layout.tsx` — wrapped `{children}` in `<Providers>`; kept existing `<Toaster/>` and metadata
- `src/app/globals.css` — added `.custom-scrollbar` + sticky-column rules
- `src/app/page.tsx` — replaced placeholder with the full app

## Conformance
- All shared types are imported from `src/lib/types.ts` — none redefined.
- No `z-ai-web-dev-sdk` import on the client (none at all in this deliverable).
- All API calls use relative paths (`/api/...`).
- Sticky footer (`min-h-screen flex flex-col` + `mt-auto`).
- Emerald/amber/teal scholarly palette — no indigo or blue.
- Lint: `bun run lint` → 0 errors, 1 benign warning (React Compiler / TanStack Table).

## Useful context for backend agent
- The frontend reads `pageSize` (camelCase) per the contract; double-check the
  backend honours it (the dev log shows successful searches with `page_size=5`,
  likely from the backend's own curl tests — make sure both spellings don't
  cause pageSize to silently fall back to default).
- `GET /api/paper/{id}?source=...` returned 500 in the dev log; the frontend
  drawer surfaces that gracefully ("Couldn't load paper detail"), but the
  backend should still be fixed for the detail tabs to populate.
- `POST /api/export` is expected to return the file as a blob
  (Content-Type text/csv or text/plain). The frontend reads `.blob()` and
  triggers a download via a temporary `<a>`.
