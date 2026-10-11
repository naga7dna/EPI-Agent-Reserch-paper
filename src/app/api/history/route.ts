import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const rows = await db.searchHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        query: r.query,
        filters: r.filters,
        resultCount: r.resultCount,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to load history: ${msg}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    await db.searchHistory.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to clear history: ${msg}` },
      { status: 500 },
    );
  }
}
