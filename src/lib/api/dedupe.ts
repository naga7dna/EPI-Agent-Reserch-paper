import { Paper } from "@/lib/types";

/**
 * Normalise a string for fuzzy title matching: lowercase, collapse whitespace,
 * strip non-alphanumeric characters. Cheap and good enough for de-duping.
 */
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dice coefficient similarity on character bigrams.
 * 1.0 = identical, 0.0 = no overlap.
 */
function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));
  let overlap = 0;
  for (const bg of bigramsA) if (bigramsB.has(bg)) overlap++;
  return (2 * overlap) / (bigramsA.size + bigramsB.size);
}

/**
 * Merge a list of papers from multiple sources, removing duplicates.
 *
 * Strategy:
 * 1. Group by normalized DOI (case-insensitive, strips "https://doi.org/").
 *    Within a DOI group, prefer Semantic Scholar (it has TLDRs).
 * 2. For papers without a DOI, fuzzy-match titles (bigram similarity >= 0.9)
 *    and merge into the existing group.
 *
 * When two papers merge, we keep the "best" non-empty value for each field
 * (preferring the canonical record), and union the fieldsOfStudy/concepts.
 */
export function dedupeByDoiAndTitle(papers: Paper[]): Paper[] {
  const seenByDoi = new Map<string, number>();
  const seenTitles: { normalized: string; index: number }[] = [];
  const out: Paper[] = [];

  const pickBetterString = (a: string | null, b: string | null): string | null =>
    (a && a.length > 0 ? a : b) ?? null;
  const pickBetterArray = (a: string[], b: string[]): string[] =>
    Array.from(new Set([...a, ...b].filter(Boolean)));
  const pickBetterNumber = (a: number | null, b: number | null): number | null =>
    a ?? b;

  const merge = (base: Paper, incoming: Paper): Paper => {
    const prefersS2 =
      base.source === "semantic_scholar" && incoming.source !== "semantic_scholar";
    const baseTldr = prefersS2 ? base.tldr : incoming.tldr ?? base.tldr;
    return {
      id: base.id,
      source: base.source,
      title: pickBetterString(base.title, incoming.title) ?? base.title,
      abstract: pickBetterString(base.abstract, incoming.abstract),
      tldr: pickBetterString(baseTldr, incoming.tldr),
      authors: base.authors.length >= incoming.authors.length ? base.authors : incoming.authors,
      year: pickBetterNumber(base.year, incoming.year),
      venue: pickBetterString(base.venue, incoming.venue),
      journal: pickBetterString(base.journal, incoming.journal),
      doi: pickBetterString(base.doi, incoming.doi),
      citationCount: Math.max(base.citationCount, incoming.citationCount),
      referenceCount: pickBetterNumber(base.referenceCount, incoming.referenceCount),
      openAccessPdfUrl: pickBetterString(base.openAccessPdfUrl, incoming.openAccessPdfUrl),
      url: pickBetterString(base.url, incoming.url),
      fieldsOfStudy: pickBetterArray(base.fieldsOfStudy, incoming.fieldsOfStudy),
      concepts: Array.from(new Map([...base.concepts, ...incoming.concepts].map((c) => [c.name, c])).values()),
      publicationTypes: pickBetterArray(base.publicationTypes, incoming.publicationTypes),
      isOpenAccess: base.isOpenAccess || incoming.isOpenAccess,
    };
  };

  const normalizeDoi = (raw: string | null): string | null => {
    if (!raw) return null;
    const m = raw.match(/10\.\d{4,9}\/[^\s]+/i);
    if (m) return m[0].toLowerCase();
    return raw.toLowerCase();
  };

  for (const p of papers) {
    const doi = normalizeDoi(p.doi);
    const normalizedTitle = normalizeTitle(p.title);

    // Try DOI match first.
    if (doi) {
      const existing = seenByDoi.get(doi);
      if (existing !== undefined) {
        out[existing] = merge(out[existing], p);
        continue;
      }
      seenByDoi.set(doi, out.length);
      out.push(p);
      seenTitles.push({ normalized: normalizedTitle, index: out.length - 1 });
      continue;
    }

    // Otherwise fuzzy-match on title.
    let matched = false;
    for (const entry of seenTitles) {
      const sim = bigramSimilarity(entry.normalized, normalizedTitle);
      if (sim >= 0.9) {
        out[entry.index] = merge(out[entry.index], p);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    out.push(p);
    seenTitles.push({ normalized: normalizedTitle, index: out.length - 1 });
  }

  return out;
}
