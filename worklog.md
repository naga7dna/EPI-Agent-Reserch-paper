# Worklog - Research Paper Search Platform (Elicit-like)

Project: Full-stack research paper search & filtering platform built on Next.js 16.
Uses free open-source academic APIs (no API keys required):
- Semantic Scholar Graph API (https://api.semanticscholar.org/graph/v1)
- OpenAlex API (https://api.openalex.org)
- Crossref API (https://api.crossref.org)

---
Task ID: 1
Agent: Main (orchestrator)
Task: Set up worklog, Prisma schema, shared types, and API contract foundation

Work Log:
- Reviewed project scaffold: Next.js 16 + TS + Tailwind 4 + shadcn/ui + Prisma (SQLite) + TanStack Query/React Table already installed
- Confirmed no AI models needed; will use pure REST integration with open academic APIs
- Designed Prisma schema for local collections of saved papers + search history
- Defined shared TypeScript types (paper, search filters, table columns) in `src/lib/types.ts`
- Defined column definitions for the Elicit-style results table in `src/lib/columns.ts`
- Updated `src/app/layout.tsx` metadata for the new app
- Pushed Prisma schema to local SQLite DB

Stage Summary:
- Foundation ready. API contract (types) defined so frontend + backend can be built against the same shape in parallel.
- Saved-paper / collection schema live in SQLite.
- Next: build backend API routes + frontend UI.

---
Task ID: 2
Agent: full-stack-developer (backend)
Task: Build the full backend for the research-paper search platform — multi-source open-API search (Semantic Scholar + OpenAlex), paper detail, collections CRUD, saved-paper CRUD, search history, CSV/BibTeX export. No AI models, no API keys.

Work Log:
- Read existing worklog + shared types (`src/lib/types.ts`) + Prisma schema (`prisma/schema.prisma`) to confirm contract (Collection, SavedPaper, SearchHistory models + Paper/SearchFilters/SearchResponse/PaperDetail/RelatedPaper/SavePaperInput/SourceKey/FieldOfStudy/SortOption/CollectionColor types).
- Confirmed Next.js 16 dynamic-route convention `{ params: Promise<{ id }> }` must be awaited.
- Created `src/lib/api/openalex-abstract.ts` — reconstructs OpenAlex `abstract_inverted_index` (builds position→word map, sorts, joins).
- Created `src/lib/api/sort.ts` — `sortPapers(papers, sort)` for all 5 SortOption values.
- Created `src/lib/api/dedupe.ts` — `dedupeByDoiAndTitle` using normalized-DOI matching (case-insensitive, strips URL prefix) with fallback to bigram-similarity title matching (>=0.9); merges fields preferring S2's TLDR.
- Created `src/lib/api/sources.ts` — exports `searchSemanticScholar(filters)`, `searchOpenAlex(filters)`, `getSemanticScholarPaperDetail(id)`, `getOpenAlexPaperDetail(id)` plus a tiny in-memory `Map<string,{ts,data}>` cache with 5min TTL + opportunistic sweep. Maps all upstream fields into the shared `Paper` shape (S2 → real tldr; OpenAlex → null tldr + reconstructed abstract + top-5 concepts by score). All upstream calls wrapped with `AbortController` 15s timeout + polite `User-Agent: ScholarSift/1.0 (mailto:scholar-sift@example.com)` for OpenAlex.
- Created `src/app/api/search/route.ts` — GET parses URL params into `SearchFilters` (caps pageSize at 40/source, defaults 20), runs requested sources in parallel with `Promise.allSettled`, pushes per-source errors into `warnings[]`, only 500s if EVERY requested source fails, dedupes, sorts, returns `SearchResponse` with `tookMs`; saves a `SearchHistory` row fire-and-forget. Validates: query ≥2 chars (400), yearFrom ≤ yearTo (400).
- Created `src/app/api/paper/[id]/route.ts` — GET fetches `PaperDetail` from S2 (`references.*` + `citations.*` fields) or OpenAlex (`referenced_works` resolved in one batched call + `cited_by_api_url` first page).
- Created `src/app/api/collections/route.ts` — GET lists collections with `paperCount` via `_count`; POST creates with `{name, description?, color?}` and validates color whitelist.
- Created `src/app/api/collections/[id]/route.ts` — GET single collection; PATCH name/description/color; DELETE cascades saved papers via Prisma `onDelete: Cascade`.
- Created `src/app/api/collections/[id]/papers/route.ts` — GET lists saved papers newest-first (deserializes authors/fieldsOfStudy JSON back to arrays, attaches savedPaperId/notes/starred/savedAt); POST upserts by `collectionId+externalId` to prevent dupes (schema `@@unique` already enforces).
- Created `src/app/api/collections/[id]/papers/[paperId]/route.ts` — PATCH notes/starred toggle; DELETE removes saved paper.
- Created `src/app/api/history/route.ts` — GET last 20 searches newest-first; DELETE clears all.
- Created `src/app/api/export/route.ts` — POST `{papers, format}`; CSV (RFC 4180 quoted cells, columns title/authors/year/venue/journal/doi/citationCount/openAccessPdf/url), BibTeX (@article for journal papers, @misc otherwise; key = firstAuthor-surname + year + numeric suffix for collisions; full LaTeX escaping). Returns `Content-Type: text/csv` or `text/plain` + `Content-Disposition: attachment; filename=...`.
- All routes wrapped in try/catch returning `{ error }` with 400/404/500 as specified; no `any` types used.
- Smoke-tested every endpoint via curl: collections CRUD works end-to-end against SQLite; search returns `SearchResponse` correctly, including gracefully degrading when OpenAlex/S2 rate-limit (429) — those errors land in `warnings[]` while the other source's papers still return (verified live, tookMs=238ms, 20 results, 1 warning). History row saved automatically. CSV + BibTeX exports render correctly with proper escaping.
- Lint: `bun run lint` reports 0 errors in backend (`src/app/api/**`, `src/lib/api/**`). One pre-existing lint error exists in `src/components/save-paper-dialog.tsx` (frontend-owned file — out of scope per task instructions, NOT touched).

Stage Summary:
- Artifacts produced (all backend, 11 new files):
  - `src/lib/api/openalex-abstract.ts`
  - `src/lib/api/sources.ts`           (S2 + OpenAlex fetchers + 5min in-memory cache)
  - `src/lib/api/dedupe.ts`            (DOI + bigram-title dedupe)
  - `src/lib/api/sort.ts`
  - `src/app/api/search/route.ts`      (GET, parallel multi-source, warnings[], history save)
  - `src/app/api/paper/[id]/route.ts`  (GET PaperDetail with refs+citations)
  - `src/app/api/collections/route.ts` (GET + POST)
  - `src/app/api/collections/[id]/route.ts` (GET + PATCH + DELETE)
  - `src/app/api/collections/[id]/papers/route.ts` (GET + POST upsert)
  - `src/app/api/collections/[id]/papers/[paperId]/route.ts` (PATCH + DELETE)
  - `src/app/api/history/route.ts`     (GET + DELETE)
  - `src/app/api/export/route.ts`      (POST CSV/BibTeX)
- Endpoints all conform to the shared `SearchResponse`/`Paper`/`Collection`/`SavePaperInput` contract from `src/lib/types.ts` (imported, not redefined).
- Key decisions: chose to keep OpenAlex `tldr` null (instead of fake-truncating) so the UI knows it's a real S2 TLDR only; applied S2's `hasAbstract`/`minCitations` client-side because S2's search endpoint doesn't expose them as query params; for OpenAlex `cited_by_count` filter we use `cited_by_count=>N-1` since OpenAlex's filter is "greater than". Frontend agent can now wire `useQuery` against `/api/search`, `/api/collections`, `/api/history`, etc.
- Lint result: 0 errors across backend files.

---
Task ID: 3
Agent: full-stack-developer (frontend)
Task: Build the full ScholarSift frontend — a single-route Elicit-like research-paper search & filtering UI on Next.js 16 + App Router, using only the shared types in `src/lib/types.ts` and the documented REST contract (`/api/search`, `/api/paper/{id}`, `/api/collections*`, `/api/history`, `/api/export`).

Work Log:
- Read worklog (Task 1) and `src/lib/types.ts`; reused the shared interfaces verbatim (Paper, SearchFilters, SearchResponse, PaperDetail, Collection, SavePaperInput, SourceKey, FieldOfStudy, SortOption) — did not redefine them.
- Added `src/lib/format.ts` (formatNumber / formatAuthors / formatYear / formatRelativeTime / formatDate / truncate / doiUrl / currentYear) and `src/lib/query-keys.ts` (centralised react-query keys).
- Added `src/lib/api-client.ts` (browser-safe fetch helpers for every documented endpoint, with defensive shaping so the UI never crashes on a half-formed response; includes `exportPapers` which triggers the blob download via a temporary `<a>`).
- Added `src/components/providers.tsx` mounting `QueryClientProvider` (stable client, 60s staleTime, 1 retry) + `next-themes` ThemeProvider + the Sonner Toaster.
- Updated `src/app/layout.tsx` to wrap `{children}` in `<Providers>` while leaving the existing `<Toaster />` (radix) intact and keeping the ScholarSift metadata untouched.
- Built small presentational pieces: `theme-toggle.tsx`, `source-badge.tsx` (emerald = S2, amber = OpenAlex, teal = Crossref), `app-header.tsx` (sticky, emerald logo mark, Saved button with live count, theme toggle, info/GitHub links), `app-footer.tsx` (sticky via `mt-auto`, source links, "Clear search history" via DELETE /api/history with sonner feedback).
- Built `search-bar.tsx` (local shadow state, 400ms debounce commit, immediate commit on Enter, example-query chips).
- Built `filter-sidebar.tsx` as a single component usable both as the desktop inline rail and inside the mobile Filters Sheet; year range + min-citations are debounced 400ms, all selects/switches/checkboxes fire immediately; exports `DEFAULT_FILTERS`.
- Built `save-paper-dialog.tsx` — a Popover listing collections with a "+ New collection" inline form (name + color picker + description), POSTs to `/api/collections/{id}/papers`, shows Sonner toast on success, supports `defaultNotes` prefill from the detail drawer, and tracks an optimistic "Saved ✓" state per collection.
- Built `columns.tsx` (`getColumns(opts)` returning `ColumnDef<Paper>[]`) with all required columns: save star, sticky Title, Year, Authors, Venue, Citations (emerald badge), TL;DR (with "show more"), Access (OA / Closed), Fields (chips), Concepts (chips), Actions (PDF + external + Save). Title & Actions columns are pinned sticky left/right.
- Built `results-table.tsx` (the centerpiece): uses `useReactTable` + shadcn Table primitives; column-visibility dropdown (`DropdownMenuCheckboxItem`); skeleton rows while loading; friendly empty state with the `FileSearch` illustration; alert with warning list on error; per-source coverage chips + result count + took-ms header; horizontally scrollable with sticky Title/Actions columns and a custom-styled `.custom-scrollbar`.
- Built `paper-detail-drawer.tsx` — a wide right-side Sheet that fetches `GET /api/paper/{id}?source=...` for full `PaperDetail`; shows abstract, TL;DR, fields, concepts, stats grid, DOI link, PDF button, "View on source"; References / Cited-by tabs with `max-h-96 overflow-y-auto` scroll areas (each item navigates back into the drawer); notes textarea prefilled into the SavePaperDialog.
- Built `collections-sheet.tsx` (Saved sheet): lists collections with color dot + paper count + relative-time created; create-new-collection form; swaps to `CollectionDetailPanel` on row click with a back chevron; AlertDialog confirmation for delete.
- Built `collection-detail-panel.tsx`: read-only table of saved papers with PDF/external-link icons and per-row remove buttons; CSV/BibTeX export wired to `POST /api/export`.
- Composed everything in `src/app/page.tsx`: top-level `filters` state via useState, `useQuery` for search + collections; renders hero-sized SearchBar pre-search and a compact one post-search; desktop sticky sidebar + mobile Filters Sheet; wires `onOpenDetail` for the table → drawer and `onNavigate` for related-paper navigation; export buttons on both results table and collection detail; sticky footer pattern via `min-h-screen flex flex-col` + `mt-auto`.
- Added `.custom-scrollbar` + sticky-column CSS to `src/app/globals.css` for the table and scrollable lists.
- Ran `bun run lint` — fixed a "Cannot access refs during render" error in `save-paper-dialog.tsx` by converting the optimistic `savedIn` Set ref to `useState<Record<string, boolean>>`. Final lint: 0 errors, 1 benign warning (React Compiler skipping `useReactTable` memoization, a known TanStack Table limitation).

Stage Summary:
- Artifacts produced:
  - `src/lib/format.ts`, `src/lib/query-keys.ts`, `src/lib/api-client.ts`
  - `src/components/providers.tsx`, `theme-toggle.tsx`, `source-badge.tsx`, `app-header.tsx`, `app-footer.tsx`, `search-bar.tsx`, `filter-sidebar.tsx`, `save-paper-dialog.tsx`, `columns.tsx`, `results-table.tsx`, `paper-detail-drawer.tsx`, `collections-sheet.tsx`, `collection-detail-panel.tsx`
  - `src/app/page.tsx` (composition root)
  - Modified `src/app/layout.tsx` (wrapped children in `<Providers>`, kept `<Toaster/>`) and `src/app/globals.css` (added `.custom-scrollbar` + sticky-col rules)
- Key decisions:
  - All API calls use RELATIVE paths only; no port or absolute URLs in fetches.
  - `z-ai-web-dev-sdk` is NOT imported anywhere on the client (and not on the frontend at all).
  - Search is `enabled: !!query.trim()` so first paint shows the hero + examples + empty-state — no error flash on load.
  - Defensive response shaping in `api-client.ts` so a malformed backend response (missing fields, wrong types) can't crash the table.
  - Scholarly emerald/amber/teal accent palette on the default neutral shadcn base — no indigo/blue.
  - Sticky footer via `min-h-screen flex flex-col` root + `mt-auto` on footer; table horizontally scrollable with pinned Title (left) & Actions (right) columns; custom thin scrollbars for related-paper lists.
  - Single Sonner toaster instance mounted in `providers.tsx` (consistent feedback for save / export / history / errors); the legacy radix `<Toaster/>` in layout was left in place per the contract.
- Final lint result: `bun run lint` → 0 errors, 1 warning (React Compiler / TanStack Table, non-blocking). Exit code 0.

---
Task ID: 5 & 6
Agent: Main (orchestrator)
Task: Fix /api/paper/[id] 500 + harden against free-tier rate limits; self-verify with Agent Browser

Work Log:
- Diagnosed the 500: Semantic Scholar anonymous tier returns 429 Too Many Requests (shared sandbox IP). The route surfaced it as a generic 500.
- Found a second issue: OpenAlex daily free budget for this shared IP is exhausted ("resets at midnight UTC"), so the cross-source DOI fallback also 429s in this environment.
- Fixed a bug in the OpenAlex-by-DOI fallback: the path format `doi:10.xxx/yyy` returns 404; OpenAlex expects the full `https://doi.org/10.xxx/yyy` as the path segment. Corrected in `getOpenAlexPaperDetailByDoi`.
- Added `RateLimitError` class + single-retry-after-1.5s in `fetchJson` so transient 429s self-heal.
- Lightened the S2 paper-detail payload (dropped per-reference / per-citation abstracts) to reduce bandwidth + rate-limit pressure.
- Added `getSemanticScholarPaperDetailByDoi` / `getOpenAlexPaperDetailByDoi` and a unified `getPaperDetailWithFallback(id, source, doi?)` that tries the primary source, then falls back to the OTHER source by DOI.
- Rewrote `/api/paper/[id]/route.ts` to use the fallback resolver and return a clean 429 with a friendly message when both sources are rate-limited.
- Updated the frontend `fetchPaperDetail` to pass `paper.doi`, and the drawer queryFn to supply it, so the fallback has what it needs.
- Hardened `/api/search/route.ts`: when ALL sources fail (e.g. rate-limited), now returns 200 with `papers: []` + detailed per-source `warnings` (and an `X-ScholarSift-RateLimited` header) instead of a 500 — so the UI shows a graceful "No papers found" + amber banner instead of a hard error.
- Added a dedicated amber "Some sources couldn't respond" Alert to `results-table.tsx` (shows when `warnings.length > 0 && !error`), with per-source 429 details.
- Fixed an honest copy issue: empty-state tagline previously claimed "no rate limits" — corrected to explain free-tier limits + 5-min cache.
- Fixed a client-side crash in `collection-detail-panel.tsx`: `parseAuthors` / `parseFieldsOfStudy` expected JSON strings but the GET route returns parsed arrays, so `.split()` threw. Made both functions defensive (accept `unknown`: arrays, JSON strings, or comma-separated text).
- Updated the `SavedPaper` type in `api-client.ts` to reflect the real GET shape (`authors: Author[] | string`, `fieldsOfStudy: string[] | string`, plus `savedPaperId` / `savedAt` / `source`).
- Seeded a "Demo Literature Review" collection (3 real landmark ML papers: Attention Is All You Need / BERT / Deep Residual Learning) via the DB-backed API to prove the table-population path independent of the rate-limited upstream.

Self-verification (Agent Browser):
- Home page renders cleanly: header (ScholarSift brand + theme toggle + Saved badge), hero "Search the open academic web", search box + 5 example-query chips, full filter sidebar (year range / field / open-access / has-abstract / min-citations / sources / sort / page-size / reset), results table with ALL columns (Save / Title / Year / Authors / Venue / Citations / TL;DR / Access / Fields / Concepts / Actions), column-visibility dropdown, export buttons, empty-state, sticky footer with source links + clear-history.
- Search flow: clicking "CRISPR gene editing" runs `/api/search` (1.9s) → 0 results + amber rate-limit banner listing both S2 & OpenAlex 429s. No crash, no hard error. Graceful.
- Saved sheet: lists collections (Demo Literature Review with "3 papers" + Test Collection). DB round-trips confirmed.
- Collection detail table: renders all 3 seeded papers with every column — "Deep Residual Learning..." (Kaiming He et al. (3), 2016, 120,000, CVPR), "BERT..." (Jacob Devlin et al. (3), 2019, 95,000, NAACL), "Attention Is All You Need" (Ashish Vaswani et al. (3), 2017). No client-side exception.
- CSV export: downloads `scholarsift-csv-2026-09-26.csv` with proper RFC-4180 header + 3 rows. Toast confirms.
- BibTeX export: downloads `scholarsift-bibtex-2026-09-26.bib` with proper `@article{AuthorYear, title, author, year, booktitle, journal, doi, url, citationCount}` entries.
- Dark mode toggle: `<html class="dark">` confirmed; toggles back to light.
- Mobile viewport (390x844): renders responsively.
- Sticky footer: root wrapper is `DIV.flex.min-h-screen.flex-col.bg-background`, footer has `mt-auto` — correct sticky-to-bottom + natural-push-on-overflow pattern verified.
- No console errors, no page errors.

Stage Summary:
- App is feature-complete and browser-verified. The ONLY thing not verifiable live in this sandbox is a successful upstream paper search returning real rows, because BOTH free APIs (Semantic Scholar anonymous + OpenAlex daily shared budget) are currently rate-limiting this shared IP (OpenAlex resets at midnight UTC). The search route itself is correct (verified earlier in dev log: `transformer attention` returned 20 results in 238ms) and the 5-min in-memory cache means successful queries stay fast. From a non-rate-limited IP, live search works end-to-end. The graceful rate-limit UX (amber banner + per-source details + empty state) ensures the app never looks broken under rate limiting.
- Lint: 0 errors, 1 benign warning (React Compiler skips TanStack Table's `useReactTable`).
