import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RateLimitError, searchOpenAlex, searchSemanticScholar } from "@/lib/api/sources";
import { dedupeByDoiAndTitle } from "@/lib/api/dedupe";
import { sortPapers } from "@/lib/api/sort";
import {
  FieldOfStudy,
  Paper,
  SearchFilters,
  SearchResponse,
  SortOption,
  SourceKey,
} from "@/lib/types";

const FIELDS_OF_STUDY: Set<string> = new Set([
  "Computer Science",
  "Medicine",
  "Biology",
  "Physics",
  "Mathematics",
  "Chemistry",
  "Economics",
  "Psychology",
  "Sociology",
  "Environmental Science",
  "Engineering",
  "Materials Science",
  "Art",
  "Business",
  "Geography",
  "History",
  "Philosophy",
  "Political Science",
]);

const SORT_OPTIONS: Set<SortOption> = new Set([
  "relevance",
  "citations_desc",
  "citations_asc",
  "year_desc",
  "year_asc",
]);

/** Parse a string into a positive integer with a default. */
function parsePositiveInt(v: string | null, def: number, max: number): number {
  if (!v) return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

/** Parses the search query string into a typed SearchFilters object. */
function parseFilters(searchParams: URLSearchParams): SearchFilters {
  const query = (searchParams.get("query") ?? "").trim();
  const yearFrom = searchParams.get("yearFrom");
  const yearTo = searchParams.get("yearTo");
  const field = searchParams.get("fieldOfStudy") ?? "";
  const openAccessOnly = searchParams.get("openAccessOnly") === "true";
  const hasAbstract = searchParams.get("hasAbstract") === "true";
  const minCitations = searchParams.get("minCitations");
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 40);
  const sortRaw = (searchParams.get("sort") ?? "relevance") as SortOption;
  const sort = SORT_OPTIONS.has(sortRaw) ? sortRaw : "relevance";
  const sourcesParam = searchParams.get("sources") ?? "semantic_scholar,openalex";
  const sources = sourcesParam
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SourceKey => s === "semantic_scholar" || s === "openalex");

  const safeSources: SourceKey[] = sources.length > 0 ? sources : ["semantic_scholar", "openalex"];

  const filters: SearchFilters = {
    query,
    openAccessOnly,
    hasAbstract,
    pageSize,
    sort,
    sources: safeSources,
  };

  if (yearFrom) {
    const y = Number(yearFrom);
    if (Number.isFinite(y) && y > 1900) filters.yearFrom = Math.floor(y);
  }
  if (yearTo) {
    const y = Number(yearTo);
    if (Number.isFinite(y) && y > 1900) filters.yearTo = Math.floor(y);
  }
  if (field && FIELDS_OF_STUDY.has(field)) {
    filters.fieldOfStudy = field as FieldOfStudy;
  } else {
    filters.fieldOfStudy = "";
  }
  if (minCitations != null && minCitations !== "") {
    const n = Number(minCitations);
    if (Number.isFinite(n) && n >= 0) filters.minCitations = Math.floor(n);
  }

  return filters;
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  const filters = parseFilters(req.nextUrl.searchParams);

  if (!filters.query || filters.query.length < 2) {
    return NextResponse.json(
      { error: "Query must contain at least 2 characters." },
      { status: 400 },
    );
  }
  if (filters.yearFrom && filters.yearTo && filters.yearFrom > filters.yearTo) {
    return NextResponse.json(
      { error: "yearFrom must be <= yearTo." },
      { status: 400 },
    );
  }

  // Run all selected sources in parallel; never let one failure break the
  // whole response. When ALL sources fail (e.g. rate-limited), we still return
  // 200 with an empty result set + warnings so the UI can show a graceful
  // "rate limited" banner instead of a hard error.
  const warnings: string[] = [];
  let rateLimited = false;
  const sourceCounts: Record<SourceKey, number> = {
    semantic_scholar: 0,
    openalex: 0,
  };
  let allPapers: Paper[] = [];

  const tasks = (filters.sources ?? ["semantic_scholar", "openalex"]).map(
    (src) => {
      const fn = src === "semantic_scholar" ? searchSemanticScholar : searchOpenAlex;
      return fn(filters)
        .then((papers) => ({ source: src, papers, error: null as string | null, rl: false }))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          const rl = err instanceof RateLimitError;
          if (rl) rateLimited = true;
          return { source: src, papers: [] as Paper[], error: msg, rl };
        });
    },
  );

  const results = await Promise.allSettled(tasks);

  let failureCount = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.error) {
        const prefix = r.value.rl
          ? `Source '${r.value.source}' is rate-limited (free tier). Try again in ~30s. `
          : `Source '${r.value.source}' failed. `;
        warnings.push(prefix + r.value.error);
        failureCount++;
      } else {
        sourceCounts[r.value.source] = r.value.papers.length;
        allPapers = allPapers.concat(r.value.papers);
      }
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      warnings.push(`Source failed: ${msg}`);
      failureCount++;
    }
  }

  // If every requested source failed, return 200 with an empty result set and
  // the accumulated warnings. The frontend shows a graceful banner.
  if (failureCount === (filters.sources?.length ?? 0)) {
    const response: SearchResponse = {
      query: filters.query,
      totalFound: 0,
      papers: [],
      sourceCounts,
      tookMs: Date.now() - start,
      warnings,
    };
    // Still record the (failed) search attempt in history for quick re-run.
    void saveHistory(filters, 0).catch(() => {});
    return NextResponse.json(response, {
      headers: rateLimited ? { "X-ScholarSift-RateLimited": "true" } : undefined,
    });
  }

  const deduped = dedupeByDoiAndTitle(allPapers);
  const sorted = sortPapers(deduped, filters.sort);

  const response: SearchResponse = {
    query: filters.query,
    totalFound: sorted.length,
    papers: sorted,
    sourceCounts,
    tookMs: Date.now() - start,
    warnings,
  };

  // Save search to history (fire-and-forget; ignore failures).
  void saveHistory(filters, sorted.length).catch(() => {});

  return NextResponse.json(response);
}

async function saveHistory(filters: SearchFilters, resultCount: number): Promise<void> {
  await db.searchHistory.create({
    data: {
      query: filters.query,
      filters: JSON.stringify(filters),
      resultCount,
    },
  });
}
