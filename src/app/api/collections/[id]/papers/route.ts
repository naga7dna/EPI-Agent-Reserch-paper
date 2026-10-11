import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Paper, SavePaperInput } from "@/lib/types";

interface SavedPaperRow {
  id: string;
  externalId: string;
  collectionId: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  authors: string;
  year: number | null;
  venue: string | null;
  citationCount: number;
  openAccessPdf: string | null;
  tldr: string | null;
  fieldsOfStudy: string;
  pdfUrl: string | null;
  url: string | null;
  notes: string | null;
  starred: boolean;
  createdAt: Date;
}

function rowToPaper(row: SavedPaperRow): Paper {
  let authors: { name: string }[] = [];
  let fieldsOfStudy: string[] = [];
  try {
    authors = JSON.parse(row.authors) as { name: string }[];
  } catch {
    authors = [];
  }
  try {
    fieldsOfStudy = JSON.parse(row.fieldsOfStudy) as string[];
  } catch {
    fieldsOfStudy = [];
  }
  return {
    id: row.externalId,
    source: "semantic_scholar",
    title: row.title,
    abstract: row.abstract,
    tldr: row.tldr,
    authors,
    year: row.year,
    venue: row.venue,
    journal: null,
    doi: row.doi,
    citationCount: row.citationCount,
    referenceCount: null,
    openAccessPdfUrl: row.openAccessPdf,
    url: row.url,
    fieldsOfStudy,
    concepts: [],
    publicationTypes: [],
    isOpenAccess: Boolean(row.openAccessPdf),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const exists = await db.collection.findUnique({ where: { id } });
    if (!exists) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    const rows = await db.savedPaper.findMany({
      where: { collectionId: id },
      orderBy: { createdAt: "desc" },
    });
    const papers = rows.map((r) =>
      rowToPaper(r as unknown as SavedPaperRow),
    );
    // Attach saved-paper metadata (notes/starred/savedId) alongside the Paper.
    const items = rows.map((r, i) => ({
      ...papers[i],
      savedPaperId: r.id,
      notes: r.notes,
      starred: r.starred,
      savedAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json(items);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to load saved papers: ${msg}` },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as SavePaperInput | null;
    if (!body || !body.paper || !body.paper.id || !body.paper.title) {
      return NextResponse.json(
        { error: "Body must include { collectionId, paper: Paper }." },
        { status: 400 },
      );
    }
    if (body.collectionId !== id) {
      return NextResponse.json(
        { error: "collectionId in body must match URL id." },
        { status: 400 },
      );
    }

    const exists = await db.collection.findUnique({ where: { id } });
    if (!exists) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }

    const paper = body.paper;
    const authorsJson = JSON.stringify(paper.authors ?? []);
    const fieldsJson = JSON.stringify(paper.fieldsOfStudy ?? []);

    // Upsert by (collectionId, externalId) so saving the same paper twice
    // is idempotent.
    const saved = await db.savedPaper.upsert({
      where: {
        collectionId_externalId: { collectionId: id, externalId: paper.id },
      },
      create: {
        collectionId: id,
        externalId: paper.id,
        doi: paper.doi ?? null,
        title: paper.title,
        abstract: paper.abstract ?? null,
        authors: authorsJson,
        year: paper.year ?? null,
        venue: paper.venue ?? null,
        citationCount: paper.citationCount ?? 0,
        openAccessPdf: paper.openAccessPdfUrl ?? null,
        tldr: paper.tldr ?? null,
        fieldsOfStudy: fieldsJson,
        pdfUrl: paper.openAccessPdfUrl ?? null,
        url: paper.url ?? null,
        notes: body.notes ?? null,
      },
      update: {
        doi: paper.doi ?? null,
        abstract: paper.abstract ?? null,
        authors: authorsJson,
        year: paper.year ?? null,
        venue: paper.venue ?? null,
        citationCount: paper.citationCount ?? 0,
        openAccessPdf: paper.openAccessPdfUrl ?? null,
        tldr: paper.tldr ?? null,
        fieldsOfStudy: fieldsJson,
        pdfUrl: paper.openAccessPdfUrl ?? null,
        url: paper.url ?? null,
      },
    });

    return NextResponse.json(
      {
        savedPaperId: saved.id,
        collectionId: saved.collectionId,
        externalId: saved.externalId,
        notes: saved.notes,
        starred: saved.starred,
        savedAt: saved.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to save paper: ${msg}` },
      { status: 500 },
    );
  }
}
