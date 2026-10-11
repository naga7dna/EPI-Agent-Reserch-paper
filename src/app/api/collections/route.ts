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

interface CreateCollectionBody {
  name?: string;
  description?: string | null;
  color?: string | null;
}

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

export async function GET() {
  try {
    const collections = await db.collection.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { papers: true } } },
    });
    return NextResponse.json(collections.map(toCollection));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to list collections: ${msg}` },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as CreateCollectionBody | null;
    if (!body || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Collection name is required." },
        { status: 400 },
      );
    }
    const name = body.name.trim().slice(0, 200);
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, 2000)
        : null;

    let color: string | null = null;
    if (typeof body.color === "string" && VALID_COLORS.includes(body.color as CollectionColor)) {
      color = body.color;
    }

    const created = await db.collection.create({
      data: { name, description, color },
      include: { _count: { select: { papers: true } } },
    });
    return NextResponse.json(toCollection(created), { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to create collection: ${msg}` },
      { status: 500 },
    );
  }
}
