"use client";

import * as React from "react";
import { createColumnHelper } from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/source-badge";
import { SavePaperDialog } from "@/components/save-paper-dialog";
import type { Paper } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  formatAuthors,
  formatNumber,
  formatYear,
  truncate,
} from "@/lib/format";

const columnHelper = createColumnHelper<Paper>();

/** Tiny "show more" cell for TL;DR / abstract previews. */
function TldrCell({ paper }: { paper: Paper }) {
  const [expanded, setExpanded] = React.useState(false);
  const raw = paper.tldr || paper.abstract || "";
  if (!raw) {
    return <span className="text-xs text-muted-foreground">No summary.</span>;
  }
  const maxLen = 240;
  const isLong = raw.length > maxLen;
  const text = expanded || !isLong ? raw : truncate(raw, maxLen);
  return (
    <div className="text-xs leading-relaxed text-muted-foreground">
      <p className={cn(expanded ? "" : "line-clamp-3")}>{text}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

interface ColumnOptions {
  onOpenDetail: (paper: Paper) => void;
  onSortCitations?: () => void;
  sortDir?: "asc" | "desc" | false;
}

/**
 * Builds the react-table ColumnDef[] for the results table.
 * The sticky Title column uses left-positioned sticky classes; the
 * surrounding `<div>` in `<Table>` already provides `overflow-x-auto`.
 */
export function getColumns(opts: ColumnOptions) {
  const { onOpenDetail } = opts;

  return [
    columnHelper.display({
      id: "save",
      header: () => (
        <span className="sr-only">Save</span>
      ),
      size: 44,
      cell: ({ row }) => (
        <SavePaperDialog paper={row.original} align="center">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Save paper to a collection"
          >
            <Star className="size-4" />
          </Button>
        </SavePaperDialog>
      ),
      meta: { className: "w-[44px]" },
    }),

    columnHelper.accessor("title", {
      id: "title",
      header: "Title",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col gap-1 pr-4">
            <button
              type="button"
              onClick={() => onOpenDetail(p)}
              className="text-left text-sm font-semibold leading-snug text-foreground hover:text-emerald-700 hover:underline dark:hover:text-emerald-400"
            >
              {p.title || "Untitled"}
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              <SourceBadge source={p.source} />
              {p.journal && (
                <span className="text-[11px] text-muted-foreground">
                  {p.journal}
                </span>
              )}
            </div>
          </div>
        );
      },
      meta: { className: "min-w-[280px] sm:min-w-[320px] sticky-col" },
    }),

    columnHelper.accessor("year", {
      id: "year",
      header: "Year",
      size: 80,
      cell: ({ getValue }) => (
        <span className="text-sm tabular-nums text-foreground">
          {formatYear(getValue())}
        </span>
      ),
      meta: { className: "w-[80px]" },
    }),

    columnHelper.accessor("authors", {
      id: "authors",
      header: "Authors",
      size: 160,
      cell: ({ row }) => {
        const { short, full } = formatAuthors(row.original.authors);
        const count = row.original.authors?.length ?? 0;
        return (
          <span
            className="text-xs text-foreground/80"
            title={full}
          >
            {short}
            {count > 1 && (
              <span className="ml-1 text-muted-foreground">({count})</span>
            )}
          </span>
        );
      },
      meta: { className: "w-[160px]" },
    }),

    columnHelper.accessor("venue", {
      id: "venue",
      header: "Venue",
      size: 160,
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="line-clamp-2 text-xs text-foreground/80">
            {getValue() ?? ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      meta: { className: "w-[160px]" },
    }),

    columnHelper.accessor("citationCount", {
      id: "citationCount",
      header: "Citations",
      size: 110,
      cell: ({ getValue }) => {
        const n = getValue() ?? 0;
        return (
          <Badge
            variant="secondary"
            className="tabular-nums bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            {formatNumber(n)}
          </Badge>
        );
      },
      meta: { className: "w-[110px]" },
    }),

    columnHelper.display({
      id: "tldr",
      header: "TL;DR",
      size: 320,
      cell: ({ row }) => <TldrCell paper={row.original} />,
      meta: { className: "min-w-[280px] sm:min-w-[320px]" },
    }),

    columnHelper.accessor("isOpenAccess", {
      id: "openAccess",
      header: "Access",
      size: 90,
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
            OA
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Closed
          </Badge>
        ),
      meta: { className: "w-[90px]" },
    }),

    columnHelper.accessor("fieldsOfStudy", {
      id: "fields",
      header: "Fields",
      size: 200,
      cell: ({ getValue }) => {
        const arr = (getValue() ?? []).slice(0, 3);
        if (arr.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {arr.map((f) => (
              <Badge
                key={f}
                variant="outline"
                className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
              >
                {f}
              </Badge>
            ))}
          </div>
        );
      },
      meta: { className: "w-[200px]" },
    }),

    columnHelper.accessor("concepts", {
      id: "concepts",
      header: "Concepts",
      size: 200,
      cell: ({ getValue }) => {
        const arr = (getValue() ?? []).slice(0, 3);
        if (arr.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {arr.map((c) => (
              <Badge key={c.name} variant="secondary" className="text-[10px]">
                {c.name}
              </Badge>
            ))}
          </div>
        );
      },
      meta: { className: "w-[200px]" },
    }),

    columnHelper.display({
      id: "actions",
      header: "Actions",
      size: 120,
      cell: ({ row }) => {
        const p = row.original;
        const pdf = p.openAccessPdfUrl || null;
        const web = p.url || null;
        return (
          <div className="flex items-center gap-1">
            {pdf && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                asChild
                aria-label="Open PDF"
              >
                <a href={pdf} target="_blank" rel="noopener noreferrer">
                  <FileText className="size-4 text-emerald-700 dark:text-emerald-400" />
                </a>
              </Button>
            )}
            {web && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                asChild
                aria-label="Open paper page"
              >
                <a href={web} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            )}
            <SavePaperDialog paper={p} align="end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                aria-label="Save paper to a collection"
              >
                <Star className="size-3.5" />
                Save
              </Button>
            </SavePaperDialog>
          </div>
        );
      },
      meta: { className: "w-[140px] sticky-right" },
    }),
  ];
}

/** Sort indicator icon used by header cells. */
export function SortIcon({ dir }: { dir: "asc" | "desc" | false }) {
  if (dir === false) return <ChevronsUpDown className="size-3 opacity-50" />;
  return dir === "asc" ? (
    <ChevronUp className="size-3" />
  ) : (
    <ChevronDown className="size-3" />
  );
}
