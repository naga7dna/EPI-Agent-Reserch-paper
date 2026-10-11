// Reconstructs OpenAlex abstracts, which are returned as an "inverted index".
//
// OpenAlex stores abstracts as `{ word: [pos1, pos2, ...], ... }` to save space.
// To get the original text back, we build a position->word map, sort by
// position, and join with spaces. Returns null when the index is missing/empty.

export type OpenAlexInvertedIndex = Record<string, number[]>;

export function reconstructAbstract(
  invertedIndex: unknown,
): string | null {
  if (!invertedIndex || typeof invertedIndex !== "object") return null;
  const index = invertedIndex as OpenAlexInvertedIndex;

  const entries = Object.entries(index);
  if (entries.length === 0) return null;

  // Build position -> word map. Some words appear multiple times (e.g. "the")
  // at different positions, so we collect all (pos, word) pairs.
  const positions: { pos: number; word: string }[] = [];
  for (const [word, idxs] of entries) {
    if (!Array.isArray(idxs)) continue;
    for (const pos of idxs) {
      if (typeof pos === "number" && Number.isFinite(pos)) {
        positions.push({ pos, word });
      }
    }
  }

  if (positions.length === 0) return null;
  positions.sort((a, b) => a.pos - b.pos);
  const text = positions.map((p) => p.word).join(" ").trim();
  return text.length > 0 ? text : null;
}
