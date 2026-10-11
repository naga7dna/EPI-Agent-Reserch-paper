import { formatDistanceToNowStrict, format } from "date-fns";
import type { Author } from "@/lib/types";

/** 12345 -> "12,345" ; null/undefined -> "—" */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US");
}

/** Returns "Smith" or "Smith et al. (12)" style summary. */
export function formatAuthors(
  authors: Author[] | null | undefined
): { short: string; full: string } {
  if (!authors || authors.length === 0) {
    return { short: "Unknown", full: "Unknown authors" };
  }
  const first = authors[0]?.name ?? "Unknown";
  if (authors.length === 1) {
    return { short: first, full: first };
  }
  return {
    short: `${first} et al.`,
    full: authors.map((a) => a.name).join(", "),
  };
}

/** Returns the year as a string, or "—" if unknown. */
export function formatYear(year: number | null | undefined): string {
  if (year === null || year === undefined || Number.isNaN(year)) return "—";
  return String(year);
}

/** Returns a human-friendly relative time string like "3 days ago". */
export function formatRelativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return "—";
    return formatDistanceToNowStrict(date, { addSuffix: true });
  } catch {
    return "—";
  }
}

/** Returns a localized absolute date like "Sep 26, 2026". */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return "—";
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

/** Truncates a long string for display, preserving whole words. */
export function truncate(text: string, max = 240): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/** Strip surrounding quotes/whitespace from a DOI string. */
export function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const trimmed = doi.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** Build a doi.org URL when given a raw DOI. */
export function doiUrl(doi: string | null | undefined): string | null {
  const d = normalizeDoi(doi);
  if (!d) return null;
  if (d.startsWith("http")) return d;
  return `https://doi.org/${d}`;
}

/** Returns the current 4-digit year. */
export function currentYear(): number {
  return new Date().getFullYear();
}
