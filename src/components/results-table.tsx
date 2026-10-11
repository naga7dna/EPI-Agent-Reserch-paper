"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnFiltersState,
  type VisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import { AlertTriangle, Columns3, FileSearch, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SourceBadge } from "@/components/source-badge";
import { getColumns } from "@/components/columns";
import type { Paper, SourceKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export interface ResultsTableProps {
  papers: Paper[];
  loading: boolean;
  error: unknown;
  warnings: string[];
  totalFound: number;
  tookMs: number;
  sourceCounts: Record<SourceKey, number>;
  hasQuery: boolean;
  onOpenDetail: (paper: Paper) => void;
  onExport: (format: "csv" | "bibtex") => void;
  exporting?: boolean;
}

const DEFAULT_VISIBILITY: VisibilityState = {
  save: true,
  title: true,
  year: true,
  authors: true,
  venue: true,
  citationCount: true,
  tldr: true,
  openAccess: true,
  fields: true,
  concepts: false,
  actions: true,
};

const SKELETON_ROWS = 6;

export function ResultsTable({
  papers,
  loading,
  error,
  warnings,
  totalFound,
  tookMs,
  sourceCounts,
  hasQuery,
  onOpenDetail,
  onExport,
  exporting = false,
}: ResultsTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(DEFAULT_VISIBILITY);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  // columnFilters is unused but declared so the typing of the table is clean.
  const [, _setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columns = React.useMemo(
    () => getColumns({ onOpenDetail }),
    [onOpenDetail]
  );

  const table = useReactTable({
    data: papers,
    columns,
    state: { columnVisibility, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    manualSorting: false,
  });

  const showEmpty = !loading && !error && papers.length === 0;
  const showError = !!error;
  const showSkeleton = loading;

  return (
    <section className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {hasQuery ? (
            <>
              <span className="font-medium text-foreground">
                {formatNumber(totalFound)}
              </span>
              results ·{" "}
              <span className="tabular-nums">{formatNumber(tookMs)} ms</span>
            </>
          ) : (
            <span>Start a search to see results.</span>
          )}
          <div className="flex items-center gap-1.5">
            {sourceCounts &&
              (Object.keys(sourceCounts) as SourceKey[]).map((k) =>
                sourceCounts[k] > 0 ? (
                  <SourceBadge key={k} source={k} count={sourceCounts[k]} />
                ) : null
              )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={papers.length === 0 || exporting}
            onClick={() => onExport("csv")}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={papers.length === 0 || exporting}
            onClick={() => onExport("bibtex")}
          >
            Export BibTeX
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Columns3 className="size-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().map((col) => {
                // Skip the save column to keep it always visible.
                if (col.id === "save") return null;
                const label = COLUMN_LABELS[col.id] ?? col.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {warnings.length > 0 && !showError && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-4" />
          <AlertTitle>Some sources couldn&apos;t respond</AlertTitle>
          <AlertDescription>
            <p className="text-xs">
              The open academic APIs (Semantic Scholar / OpenAlex) are free &
              key-less, so they rate-limit anonymous traffic. Cached queries
              still work — try re-running the search in ~30 seconds, or narrow
              the query.
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
              {warnings.map((w, i) => (
                <li key={i} className="line-clamp-2">
                  {w}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="custom-scrollbar overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-border/60">
                  {hg.headers.map((header) => {
                    const isStickyLeft = header.column.id === "title";
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted() as
                      | "asc"
                      | "desc"
                      | false;
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "h-11 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                          isStickyLeft &&
                            "sticky left-0 z-20 bg-muted/95 backdrop-blur",
                          header.column.id === "actions" &&
                            "sticky right-0 z-20 bg-muted/95 backdrop-blur"
                        )}
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            disabled={!canSort}
                            onClick={() => header.column.toggleSorting()}
                            className={cn(
                              "inline-flex items-center gap-1.5",
                              canSort && "hover:text-foreground"
                            )}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </button>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {showEmpty && !hasQuery && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-64 p-0 align-middle"
                  >
                    <EmptyState />
                  </TableCell>
                </TableRow>
              )}
              {showEmpty && hasQuery && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-48 p-0 align-middle"
                  >
                    <NoResultsState />
                  </TableCell>
                </TableRow>
              )}
              {showSkeleton &&
                Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="border-border/40">
                    {table.getAllLeafColumns().map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(
                          "h-14 px-3",
                          col.id === "title" &&
                            "sticky left-0 z-10 bg-card",
                          col.id === "actions" &&
                            "sticky right-0 z-10 bg-card"
                        )}
                      >
                        <Skeleton
                          className={cn(
                            "h-4",
                            col.id === "title" ? "w-[220px]" : "w-16"
                          )}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!showEmpty &&
                !showSkeleton &&
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-default border-border/60"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isStickyLeft = cell.column.id === "title";
                      const isStickyRight = cell.column.id === "actions";
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "px-3 align-top",
                            isStickyLeft &&
                              "sticky left-0 z-10 bg-card",
                            isStickyRight &&
                              "sticky right-0 z-10 bg-card"
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {showError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "An unknown error occurred."}
            {warnings.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

const COLUMN_LABELS: Record<string, string> = {
  title: "Title",
  year: "Year",
  authors: "Authors",
  venue: "Venue",
  citationCount: "Citations",
  tldr: "TL;DR",
  openAccess: "Access",
  fields: "Fields of study",
  concepts: "Concepts",
  actions: "Actions",
};

function EmptyState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
        <FileSearch className="size-8" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">
          Search for a topic above to begin.
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          ScholarSift queries the open academic web (Semantic Scholar &
          OpenAlex) in real time — no API keys, no AI in the loop. Free tiers
          are rate-limited, but recent searches are cached for 5 minutes. Try
          one of the example queries to get started.
        </p>
      </div>
    </div>
  );
}

function NoResultsState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <FileSearch className="size-6" />
      </div>
      <h3 className="text-base font-semibold">No papers found.</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Try widening your filters — fewer sources selected, lower citation
        threshold, or remove the open-access-only toggle.
      </p>
    </div>
  );
}

export { Loader2 };
