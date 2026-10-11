import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface PatchBody {
  notes?: string | null;
  starred?: boolean;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paperId: string }> },
) {
  try {
    const { id, paperId } = await params;
    const body = (await req.json().catch(() => null)) as PatchBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const existing = await db.savedPaper.findFirst({
      where: { id: paperId, collectionId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Saved paper not found." }, { status: 404 });
    }

    const data: { notes?: string | null; starred?: boolean } = {};
    if (body.notes !== undefined) {
      if (typeof body.notes === "string" && body.notes.trim().length > 0) {
        data.notes = body.notes.slice(0, 5000);
      } else {
        data.notes = null;
      }
    }
    if (typeof body.starred === "boolean") {
      data.starred = body.starred;
    }

    const updated = await db.savedPaper.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({
      savedPaperId: updated.id,
      collectionId: updated.collectionId,
      externalId: updated.externalId,
      notes: updated.notes,
      starred: updated.starred,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to update saved paper: ${msg}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paperId: string }> },
) {
  try {
    const { id, paperId } = await params;
    const existing = await db.savedPaper.findFirst({
      where: { id: paperId, collectionId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Saved paper not found." }, { status: 404 });
    }
    await db.savedPaper.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to delete saved paper: ${msg}` },
      { status: 500 },
    );
  }
}
