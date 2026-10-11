import { NextRequest, NextResponse } from "next/server";
import { Paper } from "@/lib/types";

interface ExportBody {
  papers?: Paper[];
  format?: "csv" | "bibtex";
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Escape a value for CSV (RFC 4180): wrap in quotes if it contains commas,
 *  quotes, or newlines, and double-up internal quotes.
 */
function csvCell(value: string): string {
  const v = value ?? "";
  if (/[\r\n,"]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function buildCsv(papers: Paper[]): string {
  const header = [
    "title",
    "authors",
    "year",
    "venue",
    "journal",
    "doi",
    "citationCount",
    "openAccessPdf",
    "url",
  ];
  const lines = [header.join(",")];
  for (const p of papers) {
    const authors = (p.authors ?? []).map((a) => a.name).join("; ");
    lines.push(
      [
        csvCell(p.title ?? ""),
        csvCell(authors),
        csvCell(p.year != null ? String(p.year) : ""),
        csvCell(p.venue ?? ""),
        csvCell(p.journal ?? ""),
        csvCell(p.doi ?? ""),
        csvCell(String(p.citationCount ?? 0)),
        csvCell(p.openAccessPdfUrl ?? ""),
        csvCell(p.url ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// BibTeX
// ---------------------------------------------------------------------------

/** Strip non-alphanumeric characters from a string for BibTeX id use. */
function bibSafe(s: string): string {
  return (s ?? "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 40);
}

function texEscape(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/#/g, "\\#")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}")
    .replace(/\$/g, "\\$");
}

function buildBibtex(papers: Paper[]): string {
  const usedKeys = new Set<string>();
  const entries: string[] = [];

  for (const p of papers) {
    const year = p.year != null ? String(p.year) : "nd";
    const firstAuthor =
      (p.authors?.[0]?.name ?? "Unknown").split(/\s+/).pop() ?? "Unknown";
    let baseKey = `${bibSafe(firstAuthor)}${year}`;
    let key = baseKey;
    let n = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}${n++}`;
    }
    usedKeys.add(key);

    const isJournal = Boolean(p.journal);
    const entryType = isJournal ? "article" : "misc";

    const fields: string[] = [];
    const title = p.title ?? "Untitled";
    fields.push(`  title = {${texEscape(title)}}`);
    if (p.authors && p.authors.length > 0) {
      const authorStr = p.authors.map((a) => texEscape(a.name)).join(" and ");
      fields.push(`  author = {${authorStr}}`);
    }
    if (p.year != null) fields.push(`  year = {${p.year}}`);
    if (p.venue) fields.push(`  booktitle = {${texEscape(p.venue)}}`);
    if (p.journal) fields.push(`  journal = {${texEscape(p.journal)}}`);
    if (p.doi) fields.push(`  doi = {${p.doi}}`);
    if (p.url) fields.push(`  url = {${p.url}}`);
    if (p.openAccessPdfUrl) fields.push(`  pdf = {${p.openAccessPdfUrl}}`);
    fields.push(`  citationCount = {${p.citationCount ?? 0}}`);

    entries.push(`@${entryType}{${key},\n${fields.join(",\n")}\n}`);
  }
  return entries.join("\n\n");
}

// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ExportBody | null;
    if (!body || !Array.isArray(body.papers)) {
      return NextResponse.json(
        { error: "Body must include { papers: Paper[] }." },
        { status: 400 },
      );
    }
    const format = body.format === "bibtex" ? "bibtex" : "csv";
    const papers = body.papers as Paper[];

    if (format === "csv") {
      const csv = buildCsv(papers);
      const filename = "papers.csv";
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const bibtex = buildBibtex(papers);
    const filename = "papers.bib";
    return new NextResponse(bibtex, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to export: ${msg}` },
      { status: 500 },
    );
  }
}
