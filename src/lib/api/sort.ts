import { Paper, SortOption } from "@/lib/types";

/**
 * Sort an in-memory list of papers by the given option.
 * Always returns a new array (does not mutate the input).
 */
export function sortPapers(
  papers: Paper[],
  sort: SortOption = "relevance",
): Paper[] {
  const copy = [...papers];
  switch (sort) {
    case "citations_desc":
      copy.sort((a, b) => b.citationCount - a.citationCount);
      break;
    case "citations_asc":
      copy.sort((a, b) => a.citationCount - b.citationCount);
      break;
    case "year_desc":
      copy.sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
      break;
    case "year_asc":
      copy.sort((a, b) => (a.year ?? Number.MAX_SAFE_INTEGER) - (b.year ?? Number.MAX_SAFE_INTEGER));
      break;
    case "relevance":
    default:
      // Relevance is preserved as upstream-ranked order. We keep stable order.
      break;
  }
  return copy;
}
