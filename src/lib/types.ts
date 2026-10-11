// Shared types for the research paper search platform.
// Used by both the backend API routes and the frontend UI so they share one contract.

export type SortOption =
  | "relevance"
  | "citations_desc"
  | "citations_asc"
  | "year_desc"
  | "year_asc";

export type FieldOfStudy =
  | "Computer Science"
  | "Medicine"
  | "Biology"
  | "Physics"
  | "Mathematics"
  | "Chemistry"
  | "Economics"
  | "Psychology"
  | "Sociology"
  | "Environmental Science"
  | "Engineering"
  | "Materials Science"
  | "Art"
  | "Business"
  | "Geography"
  | "History"
  | "Philosophy"
  | "Political Science";

export interface SearchFilters {
  query: string;
  yearFrom?: number;
  yearTo?: number;
  /** Restrict results to a single field of study (semantic-scholar fieldOfStudy bucket). */
  fieldOfStudy?: FieldOfStudy | "";
  /** Only return papers that have a free-to-read open access PDF. */
  openAccessOnly?: boolean;
  /** Only return papers that have a non-empty abstract. */
  hasAbstract?: boolean;
  minCitations?: number;
  /** How many papers to fetch per source (capped server-side). */
  pageSize?: number;
  sort?: SortOption;
  /** Which open source data sources to query. */
  sources?: SourceKey[];
}

export type SourceKey = "semantic_scholar" | "openalex";

export interface Author {
  name: string;
}

export interface Paper {
  /** Stable external id used as the React key + saved-paper dedup key. */
  id: string;
  source: SourceKey;
  title: string;
  abstract: string | null;
  /** One-line TLDR (Semantic Scholar provides a real one; OpenAlex gets a truncated abstract). */
  tldr: string | null;
  authors: Author[];
  year: number | null;
  venue: string | null;
  /** Journal / publication source (e.g. "Nature", "arXiv"). */
  journal: string | null;
  doi: string | null;
  citationCount: number;
  referenceCount: number | null;
  openAccessPdfUrl: string | null;
  /** Canonical web page for the paper. */
  url: string | null;
  fieldsOfStudy: string[];
  /** Top concepts/topics from OpenAlex (score-sorted, capped at 5). */
  concepts: Concept[];
  publicationTypes: string[];
  isOpenAccess: boolean;
}

export interface Concept {
  name: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  totalFound: number;
  papers: Paper[];
  /** Per-source counts so the UI can show coverage. */
  sourceCounts: Record<SourceKey, number>;
  /** Wall-clock ms the request took (server side). */
  tookMs: number;
  warnings: string[];
}

export interface PaperDetail extends Paper {
  references: RelatedPaper[];
  citations: RelatedPaper[];
}

export interface RelatedPaper {
  id: string;
  title: string;
  year: number | null;
  authors: Author[];
  citationCount: number;
  venue: string | null;
  abstract: string | null;
}

// ---- Saved papers / collections ----
export type CollectionColor =
  | "slate"
  | "rose"
  | "emerald"
  | "amber"
  | "violet"
  | "cyan";

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: CollectionColor | null;
  paperCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavePaperInput {
  collectionId: string;
  paper: Paper;
  notes?: string;
}
