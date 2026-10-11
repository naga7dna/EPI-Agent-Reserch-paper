import type {
  Collection,
  Paper,
  PaperDetail,
  SavePaperInput,
  SearchFilters,
  SearchResponse,
  SourceKey,
} from "@/lib/types";

/**
 * Client-side fetch helpers for the ScholarSift API.
 * All paths are RELATIVE so the built-in gateway can route them.
 *
 * NOTE: do NOT import anything from `next/*` or `z-ai-web-dev-sdk` here —
 * this file is bundled for the browser.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly warnings?: string[];
  constructor(message: string, status: number, warnings?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.warnings = warnings;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : typeof data === "string" && data.length > 0
          ? data
          : `Request failed (${res.status})`;
    const warnings =
      typeof data === "object" && data !== null && "warnings" in data
        ? (data as { warnings?: string[] }).warnings
        : undefined;
    throw new ApiError(message, res.status, warnings);
  }
  return data as T;
}

function buildSearchQuery(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.yearFrom !== undefined && filters.yearFrom !== null) {
    params.set("yearFrom", String(filters.yearFrom));
  }
  if (filters.yearTo !== undefined && filters.yearTo !== null) {
    params.set("yearTo", String(filters.yearTo));
  }
  if (filters.fieldOfStudy) params.set("fieldOfStudy", filters.fieldOfStudy);
  if (filters.openAccessOnly) params.set("openAccessOnly", "true");
  if (filters.hasAbstract) params.set("hasAbstract", "true");
  if (filters.minCitations !== undefined && filters.minCitations !== null) {
    params.set("minCitations", String(filters.minCitations));
  }
  if (filters.pageSize !== undefined && filters.pageSize !== null) {
    params.set("pageSize", String(filters.pageSize));
  }
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.sources && filters.sources.length > 0) {
    params.set("sources", filters.sources.join(","));
  }
  return params;
}

export async function searchPapers(
  filters: SearchFilters
): Promise<SearchResponse> {
  const params = buildSearchQuery(filters);
  const url = `/api/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const data = await parseJson<SearchResponse>(res);
  // Defensive defaults so the UI never crashes on a half-shaped response.
  return {
    query: data.query ?? filters.query ?? "",
    totalFound: data.totalFound ?? 0,
    papers: Array.isArray(data.papers) ? data.papers : [],
    sourceCounts: data.sourceCounts ?? {
      semantic_scholar: 0,
      openalex: 0,
    },
    tookMs: data.tookMs ?? 0,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}

export async function fetchPaperDetail(
  id: string,
  source: SourceKey,
  doi?: string | null,
): Promise<PaperDetail> {
  const params = new URLSearchParams({ source });
  if (doi) params.set("doi", doi);
  const res = await fetch(
    `/api/paper/${encodeURIComponent(id)}?${params.toString()}`,
    { headers: { Accept: "application/json" } }
  );
  return parseJson<PaperDetail>(res);
}

export async function fetchCollections(): Promise<Collection[]> {
  const res = await fetch("/api/collections", {
    headers: { Accept: "application/json" },
  });
  const list = await parseJson<Collection[]>(res);
  return Array.isArray(list) ? list : [];
}

export async function fetchCollection(id: string): Promise<Collection> {
  const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
  });
  return parseJson<Collection>(res);
}

export async function createCollection(input: {
  name: string;
  description?: string;
  color?: string;
}): Promise<Collection> {
  const res = await fetch("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<Collection>(res);
}

export async function updateCollection(
  id: string,
  patch: { name?: string; description?: string; color?: string }
): Promise<Collection> {
  const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<Collection>(res);
}

export async function deleteCollection(id: string): Promise<void> {
  const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    await parseJson<unknown>(res);
  }
}

export interface SavedPaper {
  id: string;
  externalId: string;
  collectionId: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  // The GET route returns authors as a parsed {name}[] array; defensive code
  // below also tolerates a JSON-encoded string for safety.
  authors: { name: string }[] | string;
  year: number | null;
  venue: string | null;
  citationCount: number;
  openAccessPdf: string | null;
  tldr: string | null;
  // Same as authors: may arrive as a parsed string[] or a JSON string.
  fieldsOfStudy: string[] | string;
  pdfUrl: string | null;
  url: string | null;
  notes: string | null;
  starred: boolean;
  createdAt: string;
  // Present on the GET response (not the POST response).
  savedPaperId?: string;
  savedAt?: string;
  source?: string;
}

export async function fetchCollectionPapers(
  id: string
): Promise<SavedPaper[]> {
  const res = await fetch(
    `/api/collections/${encodeURIComponent(id)}/papers`,
    { headers: { Accept: "application/json" } }
  );
  const list = await parseJson<SavedPaper[]>(res);
  return Array.isArray(list) ? list : [];
}

export async function savePaperToCollection(
  collectionId: string,
  input: SavePaperInput
): Promise<SavedPaper> {
  const res = await fetch(
    `/api/collections/${encodeURIComponent(collectionId)}/papers`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    }
  );
  return parseJson<SavedPaper>(res);
}

export async function deleteSavedPaper(
  collectionId: string,
  paperId: string
): Promise<void> {
  const res = await fetch(
    `/api/collections/${encodeURIComponent(collectionId)}/papers/${encodeURIComponent(paperId)}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 204) {
    await parseJson<unknown>(res);
  }
}

export async function updateSavedPaper(
  collectionId: string,
  paperId: string,
  patch: { notes?: string; starred?: boolean }
): Promise<SavedPaper> {
  const res = await fetch(
    `/api/collections/${encodeURIComponent(collectionId)}/papers/${encodeURIComponent(paperId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(patch),
    }
  );
  return parseJson<SavedPaper>(res);
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters: string;
  resultCount: number;
  createdAt: string;
}

export async function fetchHistory(): Promise<SearchHistoryEntry[]> {
  const res = await fetch("/api/history", {
    headers: { Accept: "application/json" },
  });
  const list = await parseJson<SearchHistoryEntry[]>(res);
  return Array.isArray(list) ? list : [];
}

export async function clearHistory(): Promise<void> {
  const res = await fetch("/api/history", { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson<unknown>(res);
  }
}

/**
 * POST papers to the export endpoint and trigger a browser download.
 * Returns the local file name chosen for the download.
 */
export async function exportPapers(
  papers: Paper[],
  format: "csv" | "bibtex"
): Promise<string> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ papers, format }),
  });
  if (!res.ok) {
    throw new ApiError(`Export failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const contentType = res.headers.get("Content-Type") ?? "text/plain";
  const ext = format === "csv" ? "csv" : "bib";
  const filename = `scholarsift-${format}-${new Date()
    .toISOString()
    .slice(0, 10)}.${ext}`;
  const url = URL.createObjectURL(new Blob([blob], { type: contentType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Free memory on the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return filename;
}
