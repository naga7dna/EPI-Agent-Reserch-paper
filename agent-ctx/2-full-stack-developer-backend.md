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
