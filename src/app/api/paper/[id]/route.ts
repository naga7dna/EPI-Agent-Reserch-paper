import { NextRequest, NextResponse } from "next/server";
import { getPaperDetailWithFallback, RateLimitError } from "@/lib/api/sources";
import { SourceKey } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Paper id is required." }, { status: 400 });
    }

    const sourceParam = req.nextUrl.searchParams.get("source");
    const source: SourceKey =
      sourceParam === "openalex" ? "openalex" : "semantic_scholar";
    const doi = req.nextUrl.searchParams.get("doi") || null;

    const { detail, usedFallback, rateLimited } = await getPaperDetailWithFallback(
      id,
      source,
      doi,
    );

    return NextResponse.json(detail, {
      headers: usedFallback
        ? { "X-ScholarSift-Fallback": "true" }
        : { "X-ScholarSift-Fallback": "false" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Rate-limit: tell the client to back off, with a friendly message.
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        {
          error:
            "The open academic APIs are rate-limiting us right now (anonymous tier). Please wait ~30 seconds and try again.",
          rateLimited: true,
        },
        { status: 429 },
      );
    }

    // Distinguish "not found" upstream errors from real 5xx errors.
    const is404 = /404|not found|incomplete/i.test(msg);
    return NextResponse.json(
      { error: `Failed to load paper: ${msg}` },
      { status: is404 ? 404 : 500 },
    );
  }
}
