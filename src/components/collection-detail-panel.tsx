"use client";

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  FileText,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchCollectionPapers,
  deleteSavedPaper,
  exportPapers,
  type SavedPaper,
} from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Author, Paper } from "@/lib/types";
import {
  formatNumber,
  formatRelativeTime,
  formatYear,
  truncate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface CollectionDetailPanelProps {
  collectionId: string;
}

/** Parse the authors field on a saved paper row. Tolerates either a parsed
 *  {name}[] array (what the GET route returns) or a JSON-encoded string. */
function parseAuthors(raw: unknown): Author[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (a) =>
          a !== null && typeof a === "object" && typeof (a as { name?: unknown }).name === "string"
      )
      .map((a) => ({ name: (a as { name: string }).name }));
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // Try JSON first (the DB stores a JSON string).
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parseAuthors(parsed);
      }
    } catch {
      // not JSON — fall through to comma-separated handling
    }
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }
  return [];
}

function parseFieldsOfStudy(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parseFieldsOfStudy(parsed);
      }
    } catch {
      // not JSON
    }
    return trimmed
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Convert a saved-paper Prisma row into the shared `Paper` shape (for export). */
function toPaper(s: SavedPaper): Paper {
  return {
    id: s.externalId || s.id,
    source: "semantic_scholar",
    title: s.title,
    abstract: s.abstract,
    tldr: s.tldr,
    authors: parseAuthors(s.authors),
    year: s.year,
    venue: s.venue,
    journal: s.venue,
    doi: s.doi,
    citationCount: s.citationCount ?? 0,
    referenceCount: null,
    openAccessPdfUrl: s.openAccessPdf || s.pdfUrl,
    url: s.url,
    fieldsOfStudy: parseFieldsOfStudy(s.fieldsOfStudy),
    concepts: [],
    publicationTypes: [],
    isOpenAccess: !!(s.openAccessPdf || s.pdfUrl),
  };
}

export function CollectionDetailPanel({
  collectionId,
}: CollectionDetailPanelProps) {
  const qc = useQueryClient();
  const { data: papers = [], isLoading, isError, error } = useQuery({
    queryKey: qk.collectionPapers(collectionId),
    queryFn: () => fetchCollectionPapers(collectionId),
    enabled: !!collectionId,
  });

  const removeMut = useMutation({
    mutationFn: ({
      collectionId,
      paperId,
    }: {
      collectionId: string;
      paperId: string;
    }) => deleteSavedPaper(collectionId, paperId),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({
        queryKey: qk.collectionPapers(vars.collectionId),
      });
      await qc.invalidateQueries({ queryKey: qk.collections() });
      toast.success("Paper removed from collection.");
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Couldn't remove paper.";
      toast.error("Couldn't remove paper", { description: msg });
    },
  });

  const [exporting, setExporting] = React.useState(false);
  const handleExport = async (format: "csv" | "bibtex") => {
    setExporting(true);
    try {
      const mapped = papers.map(toPaper);
      const filename = await exportPapers(mapped, format);
      toast.success(`Exported ${mapped.length} papers as ${filename}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Export failed.";
      toast.error("Export failed", { description: msg });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {papers.length} saved paper{papers.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={papers.length === 0 || exporting}
            onClick={() => handleExport("csv")}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={papers.length === 0 || exporting}
            onClick={() => handleExport("bibtex")}
          >
            Export BibTeX
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading saved papers…
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load saved papers:{" "}
          {error instanceof Error ? error.message : "Unknown error."}
        </p>
      )}
      {!isLoading && !isError && papers.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          This collection is empty. Save papers from the search results to
          see them here.
        </p>
      )}
      {!isLoading && !isError && papers.length > 0 && (
        <div className="custom-scrollbar overflow-x-auto rounded-md border border-border/60">
          <Table className="min-w-full">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="min-w-[260px]">Title</TableHead>
                <TableHead className="w-20">Year</TableHead>
                <TableHead className="min-w-[140px]">Authors</TableHead>
                <TableHead className="w-24">Citations</TableHead>
                <TableHead className="min-w-[160px]">Venue</TableHead>
                <TableHead className="w-32">Added</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {papers.map((p) => {
                const authors = parseAuthors(p.authors);
                const first = authors[0]?.name ?? "Unknown";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-0.5 pr-2">
                        <span className="text-sm font-medium leading-snug">
                          {p.title}
                        </span>
                        {p.notes && (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            📝 {p.notes}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top tabular-nums">
                      {formatYear(p.year)}
                    </TableCell>
                    <TableCell className="align-top text-xs">
                      {first}
                      {authors.length > 1 && (
                        <span className="text-muted-foreground">
                          {" "}
                          et al. ({authors.length})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant="secondary"
                        className="tabular-nums bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        {formatNumber(p.citationCount)}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-xs">
                      {p.venue ? truncate(p.venue, 60) : "—"}
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {formatRelativeTime(p.createdAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center justify-end gap-1">
                        {(p.openAccessPdf || p.pdfUrl) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            asChild
                            aria-label="Open PDF"
                          >
                            <a
                              href={p.openAccessPdf || p.pdfUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText className="size-3.5 text-emerald-700 dark:text-emerald-400" />
                            </a>
                          </Button>
                        )}
                        {p.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            asChild
                            aria-label="Open paper page"
                          >
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          aria-label="Remove from collection"
                          disabled={removeMut.isPending}
                          onClick={() =>
                            removeMut.mutate({
                              collectionId,
                              paperId: p.id,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
