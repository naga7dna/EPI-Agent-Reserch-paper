import type { SearchFilters } from "@/lib/types";

/**
 * Centralised React Query keys so cache invalidation in one component
 * reliably busts queries used by other components.
 */
export const qk = {
  search: (filters: SearchFilters) => ["search", filters] as const,
  paper: (id: string, source: string) => ["paper", id, source] as const,
  collections: () => ["collections"] as const,
  collection: (id: string) => ["collection", id] as const,
  collectionPapers: (id: string) => ["collection", id, "papers"] as const,
  history: () => ["history"] as const,
} as const;
