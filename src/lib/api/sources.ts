import { reconstructAbstract } from "@/lib/api/openalex-abstract";
import {
  Author,
  Concept,
  Paper,
  PaperDetail,
  RelatedPaper,
  SearchFilters,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// In-memory cache with TTL.
// ---------------------------------------------------------------------------
// Both upstream APIs are rate-limited; we cache by a derived key for 5 minutes.
// Cache values are either Paper[] or PaperDetail, depending on the key prefix.

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { ts: number; data: T };
const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T): void {
  cache.set(key, { ts: Date.now(), data });
  // Opportunistic sweep: prune expired entries every now and then.
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL_MS) cache.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SS_FIELDS =
  "paperId,title,abstract,tldr,year,venue,journal,authors,citationCount,referenceCount,openAccessPdf,fieldsOfStudy,publicationTypes,externalIds,url";

const UA =
  "ScholarSift/1.0 (mailto:scholar-sift@example.com)";

/** Thrown when an upstream API responds 429 Too Many Requests. */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Single helper to fetch + parse JSON with a timeout + one 429 retry. */
async function fetchJson<T>(url: string, headers?: HeadersInit, timeoutMs = 15000): Promise<T> {
  const doFetch = async (): Promise<T> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) {
          throw new RateLimitError(
            `upstream 429 Too Many Requests: ${body.slice(0, 160)}`,
          );
        }
        throw new Error(
          `upstream ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
        );
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    return await doFetch();
  } catch (err) {
    // On a 429, wait briefly and retry exactly once. If it still fails the
    // RateLimitError propagates so callers can surface a clean message.
    if (err instanceof RateLimitError) {
      await new Promise((r) => setTimeout(r, 1500));
      return doFetch();
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Semantic Scholar
// ---------------------------------------------------------------------------

interface S2Author {
  name?: string;
}
interface S2Tldr {
  text?: string;
}
interface S2Paper {
  paperId?: string;
  title?: string;
  abstract?: string;
  tldr?: S2Tldr | null;
  year?: number | null;
  venue?: string | null;
  journal?: { name?: string | null } | null;
  authors?: S2Author[];
  citationCount?: number;
  referenceCount?: number | null;
  openAccessPdf?: { url?: string | null } | null;
  fieldsOfStudy?: string[] | null;
  publicationTypes?: string[] | null;
  externalIds?: { DOI?: string | null } | null;
  url?: string | null;
}

function mapS2Paper(p: S2Paper): Paper | null {
  if (!p.paperId || !p.title) return null;
  return {
    id: p.paperId,
    source: "semantic_scholar",
    title: p.title,
    abstract: p.abstract ?? null,
    tldr: p.tldr?.text ?? null,
    authors: (p.authors ?? [])
      .filter((a) => a && a.name)
      .map((a) => ({ name: a.name as string })),
    year: typeof p.year === "number" ? p.year : null,
    venue: p.venue || null,
    journal: p.journal?.name || null,
    doi: p.externalIds?.DOI ?? null,
    citationCount: typeof p.citationCount === "number" ? p.citationCount : 0,
    referenceCount: p.referenceCount ?? null,
    openAccessPdfUrl: p.openAccessPdf?.url ?? null,
    url: p.url ?? null,
    fieldsOfStudy: (p.fieldsOfStudy ?? []).filter(Boolean) as string[],
    concepts: [],
    publicationTypes: (p.publicationTypes ?? []).filter(Boolean) as string[],
    isOpenAccess: Boolean(p.openAccessPdf?.url),
  };
}

function buildS2QueryParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams({
    query: filters.query,
    fields: SS_FIELDS,
  });
  const limit = Math.min(Math.max(filters.pageSize ?? 20, 1), 40);
  params.set("limit", String(limit));

  // Year filters: S2 supports `year=2020-2024` style range.
  const yFrom = filters.yearFrom;
  const yTo = filters.yearTo;
  if (yFrom != null && yTo != null) {
    params.set("year", `${yFrom}-${yTo}`);
  } else if (yFrom != null) {
    params.set("year", `${yFrom}-`);
  } else if (yTo != null) {
    params.set("year", `-${yTo}`);
  }

  if (filters.fieldOfStudy) {
    // S2 expects a comma-joined list of fields; we only have one at a time.
    params.set("fieldsOfStudy", filters.fieldOfStudy as string);
  }

  if (filters.openAccessOnly) {
    params.set("openAccessPdf", "");
  }

  return params;
}

export async function searchSemanticScholar(filters: SearchFilters): Promise<Paper[]> {
  const params = buildS2QueryParams(filters);
  const cacheKey = `ss:search:${params.toString()}`;
  const cached = cacheGet<Paper[]>(cacheKey);
  if (cached) return cached;

  const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;
  const json = await fetchJson<{
    data?: S2Paper[];
    total?: number;
  }>(url);

  const raw = json.data ?? [];
  let papers: Paper[] = raw
    .map(mapS2Paper)
    .filter((p): p is Paper => p !== null);

  // S2 doesn't expose minCitations or hasAbstract server-side; apply locally.
  if (filters.hasAbstract) {
    papers = papers.filter((p) => Boolean(p.abstract));
  }
  if (typeof filters.minCitations === "number" && filters.minCitations > 0) {
    papers = papers.filter((p) => p.citationCount >= (filters.minCitations as number));
  }

  cacheSet(cacheKey, papers);
  return papers;
}

// ---------------------------------------------------------------------------
// OpenAlex
// ---------------------------------------------------------------------------

interface OAInstitution { id?: string; display_name?: string }
interface OAAuthorship {
  author?: { display_name?: string; id?: string };
  institutions?: OAInstitution[];
}
interface OAConcept { display_name?: string; score?: number; id?: string }
interface OALocation {
  source?: { display_name?: string; id?: string } | null;
  pdf_url?: string | null;
  landing_page_url?: string | null;
  is_oa?: boolean | null;
  licence?: string | null;
  version?: string | null;
}
interface OAPaper {
  id?: string;
  doi?: string | null;
  title?: string;
  publication_year?: number | null;
  authorships?: OAAuthorship[];
  primary_location?: OALocation | null;
  best_oa_location?: OALocation | null;
  cited_by_count?: number;
  referenced_works_count?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  concepts?: OAConcept[];
  topics?: OAConcept[];
  open_access?: { is_oa?: boolean | null; oa_status?: string | null; oa_url?: string | null } | null;
  type?: string | null;
  ids?: { doi?: string | null; openalex?: string | null } | null;
}

const OA_SELECT =
  "id,doi,title,publication_year,authorships,primary_location,best_oa_location,cited_by_count,referenced_works_count,abstract_inverted_index,concepts,topics,open_access,type,ids";

function mapOAPaper(p: OAPaper): Paper | null {
  if (!p.id || !p.title) return null;
  // OpenAlex ids look like "https://openalex.org/W1234". Extract the slug as
  // our external id so callers can use it directly with the OpenAlex API.
  const id = p.id.replace(/^https?:\/\/openalex\.org\//i, "");
  const abstract = reconstructAbstract(p.abstract_inverted_index);

  const concepts: Concept[] = (p.concepts ?? p.topics ?? [])
    .filter((c) => c && c.display_name && typeof c.score === "number")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((c) => ({ name: c.display_name as string, score: c.score as number }));

  const authors: Author[] = (p.authorships ?? [])
    .map((a) => a.author?.display_name)
    .filter((v): v is string => Boolean(v))
    .map((name) => ({ name }));

  const pdfUrl =
    p.best_oa_location?.pdf_url || p.primary_location?.pdf_url || p.open_access?.oa_url || null;

  const journal =
    p.primary_location?.source?.display_name ||
    p.best_oa_location?.source?.display_name ||
    null;

  return {
    id,
    source: "openalex",
    title: p.title,
    abstract,
    // OpenAlex has no TLDR; we synthesize a short truncation in the search
    // route when needed. Left null here so callers know it's not real.
    tldr: null,
    authors,
    year: typeof p.publication_year === "number" ? p.publication_year : null,
    venue: null,
    journal,
    doi: p.doi ? p.doi.replace(/^https?:\/\/doi\.org\//i, "") : null,
    citationCount: typeof p.cited_by_count === "number" ? p.cited_by_count : 0,
    referenceCount: p.referenced_works_count ?? null,
    openAccessPdfUrl: pdfUrl,
    url: p.primary_location?.landing_page_url || (p.id ?? null),
    fieldsOfStudy: [], // OpenAlex doesn't tag S2-style buckets natively
    concepts,
    publicationTypes: [p.type].filter(Boolean) as string[],
    isOpenAccess: Boolean(p.open_access?.is_oa ?? pdfUrl),
  };
}

function buildOAQueryParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams({
    search: filters.fieldOfStudy
      ? `${filters.query} ${filters.fieldOfStudy}`
      : filters.query,
    select: OA_SELECT,
    "per-page": String(Math.min(Math.max(filters.pageSize ?? 20, 1), 40)),
  });
  const oaFilters: string[] = [];
  // mailto for the polite pool.
  params.set("mailto", "scholar-sift@example.com");

  if (filters.yearFrom != null) {
    oaFilters.push(`from_publication_date:${filters.yearFrom}-01-01`);
  }
  if (filters.yearTo != null) {
    oaFilters.push(`to_publication_date:${filters.yearTo}-12-31`);
  }
  if (filters.openAccessOnly) {
    oaFilters.push("is_oa:true");
  }
  if (typeof filters.minCitations === "number" && filters.minCitations > 0) {
    oaFilters.push(`cited_by_count:>${filters.minCitations - 1}`);
  }
  if (filters.hasAbstract) {
    oaFilters.push("has_abstract:true");
  }
  if (oaFilters.length > 0) params.set("filter", oaFilters.join(","));
  return params;
}

export async function searchOpenAlex(filters: SearchFilters): Promise<Paper[]> {
  const params = buildOAQueryParams(filters);
  const cacheKey = `oa:search:${params.toString()}`;
  const cached = cacheGet<Paper[]>(cacheKey);
  if (cached) return cached;

  const url = `https://api.openalex.org/works?${params.toString()}`;
  const json = await fetchJson<{
    results?: OAPaper[];
    meta?: { count?: number };
  }>(url, { "User-Agent": UA });

  const papers: Paper[] = (json.results ?? [])
    .map(mapOAPaper)
    .filter((p): p is Paper => p !== null);

  cacheSet(cacheKey, papers);
  return papers;
}

// ---------------------------------------------------------------------------
// Paper detail (references + citations)
// ---------------------------------------------------------------------------

function mapS2Related(p: S2Paper | undefined): RelatedPaper | null {
  if (!p || !p.paperId || !p.title) return null;
  return {
    id: p.paperId,
    title: p.title,
    year: typeof p.year === "number" ? p.year : null,
    authors: (p.authors ?? [])
      .filter((a) => a && a.name)
      .map((a) => ({ name: a.name as string })),
    citationCount: typeof p.citationCount === "number" ? p.citationCount : 0,
    venue: p.venue || null,
    abstract: p.abstract ?? null,
  };
}

/**
 * Fetch a Semantic Scholar paper detail by an arbitrary id-path segment.
 * Accepts either a raw paperId (40-char hex) or a DOI: prefix, ARXIV: prefix, etc.
 * We deliberately do NOT request per-reference abstracts (heavy payload, more
 * likely to trip the anonymous rate-limit); the drawer only needs titles.
 */
async function getSemanticScholarPaperDetailByIdPath(idPath: string): Promise<PaperDetail> {
  const cacheKey = `ss:detail:${idPath}`;
  const cached = cacheGet<PaperDetail>(cacheKey);
  if (cached) return cached;

  const fields = `${SS_FIELDS},references.paperId,references.title,references.year,references.authors,references.citationCount,references.venue,citations.paperId,citations.title,citations.year,citations.authors,citations.citationCount,citations.venue`;
  const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(
    idPath,
  )}?fields=${fields}`;
  const p = await fetchJson<S2Paper & {
    references?: (S2Paper | null)[];
    citations?: (S2Paper | null)[];
  }>(url);

  const base = mapS2Paper(p);
  if (!base) throw new Error("Semantic Scholar returned an incomplete paper record");

  const references: RelatedPaper[] = (p.references ?? [])
    .map(mapS2Related)
    .filter((r): r is RelatedPaper => r !== null);
  const citations: RelatedPaper[] = (p.citations ?? [])
    .map(mapS2Related)
    .filter((r): r is RelatedPaper => r !== null);

  const detail: PaperDetail = { ...base, references, citations };
  cacheSet(cacheKey, detail);
  return detail;
}

export async function getSemanticScholarPaperDetail(id: string): Promise<PaperDetail> {
  return getSemanticScholarPaperDetailByIdPath(id);
}

/** Look up a paper on Semantic Scholar by its DOI. */
export async function getSemanticScholarPaperDetailByDoi(doi: string): Promise<PaperDetail> {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
  return getSemanticScholarPaperDetailByIdPath(`DOI:${cleanDoi}`);
}

export async function getOpenAlexPaperDetail(id: string): Promise<PaperDetail> {
  const cacheKey = `oa:detail:${id}`;
  const cached = cacheGet<PaperDetail>(cacheKey);
  if (cached) return cached;

  // OpenAlex ids can be either "W1234" or full URLs; normalise to bare slug.
  const slug = id.replace(/^https?:\/\/openalex\.org\//i, "");
  const fullId = slug.startsWith("W") ? slug : `W${slug}`;

  const url = `https://api.openalex.org/works/${fullId}?select=id,doi,title,publication_year,authorships,primary_location,best_oa_location,cited_by_count,referenced_works_count,abstract_inverted_index,concepts,topics,open_access,type,ids,referenced_works,cited_by_api_url`;
  const p = await fetchJson<OAPaper & { referenced_works?: string[]; cited_by_api_url?: string }>(
    url,
    { "User-Agent": UA },
  );

  return buildOpenAlexDetail(p, cacheKey);
}

/** Look up a paper on OpenAlex by its DOI. */
export async function getOpenAlexPaperDetailByDoi(doi: string): Promise<PaperDetail> {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
  const cacheKey = `oa:detail:doi:${cleanDoi}`;
  const cached = cacheGet<PaperDetail>(cacheKey);
  if (cached) return cached;

  // OpenAlex accepts the full DOI URL as a path segment (slashes literal).
  const url = `https://api.openalex.org/works/https://doi.org/${cleanDoi}?select=id,doi,title,publication_year,authorships,primary_location,best_oa_location,cited_by_count,referenced_works_count,abstract_inverted_index,concepts,topics,open_access,type,ids,referenced_works,cited_by_api_url&mailto=scholar-sift@example.com`;
  const p = await fetchJson<OAPaper & { referenced_works?: string[]; cited_by_api_url?: string }>(
    url,
    { "User-Agent": UA },
  );

  return buildOpenAlexDetail(p, cacheKey);
}

/** Shared mapping for the two OpenAlex detail entry points. */
async function buildOpenAlexDetail(
  p: OAPaper & { referenced_works?: string[]; cited_by_api_url?: string },
  cacheKey: string,
): Promise<PaperDetail> {
  const base = mapOAPaper(p);
  if (!base) throw new Error("OpenAlex returned an incomplete paper record");

  // References: OpenAlex lists referenced_works as bare OpenAlex IDs only.
  // Fetch up to the first 25 of them in a single batched call.
  const referencedIds = (p.referenced_works ?? []).slice(0, 25);
  const references: RelatedPaper[] = [];

  if (referencedIds.length > 0) {
    const filter = referencedIds.map((rid) => `|${rid}`).join("");
    const refUrl = `https://api.openalex.org/works?filter=openalex_id:${encodeURIComponent(
      filter.slice(1),
    )}&select=id,title,publication_year,authorships,cited_by_count,primary_location&per-page=200&mailto=scholar-sift@example.com`;
    const refJson = await fetchJson<{ results?: OAPaper[] }>(refUrl, {
      "User-Agent": UA,
    }).catch(() => ({ results: [] as OAPaper[] }));
    for (const rp of refJson.results ?? []) {
      const rid = rp.id?.replace(/^https?:\/\/openalex\.org\//i, "");
      if (!rid || !rp.title) continue;
      references.push({
        id: rid,
        title: rp.title,
        year: typeof rp.publication_year === "number" ? rp.publication_year : null,
        authors: (rp.authorships ?? [])
          .map((a) => a.author?.display_name)
          .filter((v): v is string => Boolean(v))
          .map((name) => ({ name })),
        citationCount: typeof rp.cited_by_count === "number" ? rp.cited_by_count : 0,
        venue: rp.primary_location?.source?.display_name ?? null,
        abstract: null,
      });
    }
  }

  // Citations: OpenAlex gives a `cited_by_api_url` that lists citing works
  // (paginated). Fetch the first page of 25.
  const citations: RelatedPaper[] = [];
  if (p.cited_by_api_url) {
    const citedUrl = `${p.cited_by_api_url}&per-page=25&select=id,title,publication_year,authorships,cited_by_count,primary_location&mailto=scholar-sift@example.com`;
    const citedJson = await fetchJson<{ results?: OAPaper[] }>(citedUrl, {
      "User-Agent": UA,
    }).catch(() => ({ results: [] as OAPaper[] }));
    for (const cp of citedJson.results ?? []) {
      const cid = cp.id?.replace(/^https?:\/\/openalex\.org\//i, "");
      if (!cid || !cp.title) continue;
      citations.push({
        id: cid,
        title: cp.title,
        year: typeof cp.publication_year === "number" ? cp.publication_year : null,
        authors: (cp.authorships ?? [])
          .map((a) => a.author?.display_name)
          .filter((v): v is string => Boolean(v))
          .map((name) => ({ name })),
        citationCount: typeof cp.cited_by_count === "number" ? cp.cited_by_count : 0,
        venue: cp.primary_location?.source?.display_name ?? null,
        abstract: null,
      });
    }
  }

  const detail: PaperDetail = { ...base, references, citations };
  cacheSet(cacheKey, detail);
  return detail;
}

// ---------------------------------------------------------------------------
// Unified paper-detail resolver with cross-source fallback
// ---------------------------------------------------------------------------

/**
 * Try the requested source first. If it fails for any reason (rate limit,
 * 404, network) and a DOI is provided, fall back to the OTHER source by DOI.
 * Throws the most informative error if both paths fail.
 */
export async function getPaperDetailWithFallback(
  id: string,
  source: SourceKey,
  doi?: string | null,
): Promise<{ detail: PaperDetail; usedFallback: boolean; rateLimited: boolean }> {
  const cleanDoi = doi ? doi.replace(/^https?:\/\/doi\.org\//i, "") : null;

  const tryPrimary =
    source === "openalex"
      ? () => getOpenAlexPaperDetail(id)
      : () => getSemanticScholarPaperDetail(id);

  try {
    const detail = await tryPrimary();
    return { detail, usedFallback: false, rateLimited: false };
  } catch (primaryErr) {
    // If we have a DOI, try the other source.
    if (cleanDoi) {
      try {
        const detail =
          source === "openalex"
            ? await getSemanticScholarPaperDetailByDoi(cleanDoi)
            : await getOpenAlexPaperDetailByDoi(cleanDoi);
        return { detail, usedFallback: true, rateLimited: false };
      } catch {
        // fall through to rethrowing the primary error
      }
    }
    const rateLimited = primaryErr instanceof RateLimitError;
    throw rateLimited
      ? new RateLimitError(
          `Both sources unavailable${cleanDoi ? " (also tried DOI fallback)" : ""}: ${primaryErr.message}`,
        )
      : primaryErr;
  }
}
