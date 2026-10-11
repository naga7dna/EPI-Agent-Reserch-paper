import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Collection, CollectionColor } from "@/lib/types";

const VALID_COLORS: CollectionColor[] = [
  "slate",
  "rose",
  "emerald",
  "amber",
  "violet",
  "cyan",
];

function toCollection(row: {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { papers: number };
}): Collection {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: (row.color as CollectionColor | null) ?? null,
    paperCount: row._count?.papers ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = await db.collection.findUnique({
      where: { id },
      include: { _count: { select: { papers: true } } },
    });
    if (!row) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    return NextResponse.json(toCollection(row));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to load collection: ${msg}` },
      { status: 500 },
    );
  }
}

interface PatchBody {
  name?: string;
  description?: string | null;
  color?: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as PatchBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const existing = await db.collection.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    const data: { name?: string; description?: string | null; color?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim().length > 0) {
      data.name = body.name.trim().slice(0, 200);
    }
    if (body.description !== undefined) {
      if (typeof body.description === "string" && body.description.trim().length > 0) {
        data.description = body.description.trim().slice(0, 2000);
      } else {
        data.description = null;
      }
    }
    if (body.color !== undefined) {
      if (
        typeof body.color === "string" &&
        VALID_COLORS.includes(body.color as CollectionColor)
      ) {
        data.color = body.color;
      } else if (body.color === null) {
        data.color = null;
      }
    }
    const updated = await db.collection.update({
      where: { id },
      data,
      include: { _count: { select: { papers: true } } },
    });
    return NextResponse.json(toCollection(updated));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to update collection: ${msg}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Schema has onDelete: Cascade on SavedPaper, so deletion will remove
    // associated saved papers automatically.
    const deleted = await db.collection.delete({ where: { id } }).catch(() => null);
    if (!deleted) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to delete collection: ${msg}` },
      { status: 500 },
    );
  }
}
