"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { SearchBar } from "@/components/search-bar";
import {
  FilterSidebar,
  DEFAULT_FILTERS,
} from "@/components/filter-sidebar";
import { ResultsTable } from "@/components/results-table";
import { PaperDetailDrawer } from "@/components/paper-detail-drawer";
import { CollectionsSheet } from "@/components/collections-sheet";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { searchPapers, exportPapers, fetchCollections } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Paper, RelatedPaper, SearchFilters, SourceKey } from "@/lib/types";
import { toast } from "sonner";

export default function Home() {
  // ----- Top-level search/filters state -----
  const [filters, setFilters] = React.useState<SearchFilters>(DEFAULT_FILTERS);
  const [collectionsOpen, setCollectionsOpen] = React.useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = React.useState(false);
  const [detailPaper, setDetailPaper] = React.useState<Paper | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  // Live collections query for the header badge & sidebar list freshness.
  const { data: collections = [] } = useQuery({
    queryKey: qk.collections(),
    queryFn: fetchCollections,
    staleTime: 60_000,
  });
  const savedCount = collections.reduce((n, c) => n + c.paperCount, 0);

  // ----- Search query -----
  const hasQuery = filters.query.trim().length > 0;
  const {
    data: searchResponse,
    isFetching: isSearchFetching,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: qk.search(filters),
    queryFn: () => searchPapers(filters),
    enabled: hasQuery,
    staleTime: 60_000,
    retry: false,
  });

  // Defensive shaping so the UI never crashes on a malformed response.
  const papers: Paper[] = searchResponse?.papers ?? [];
  const totalFound = searchResponse?.totalFound ?? 0;
  const tookMs = searchResponse?.tookMs ?? 0;
  const sourceCounts = searchResponse?.sourceCounts ?? {
    semantic_scholar: 0,
    openalex: 0,
  };
  const warnings: string[] = searchResponse?.warnings ?? [];

  // ----- Handlers -----
  const onCommitQuery = React.useCallback(
    (q: string) => {
      setFilters((f) => ({ ...f, query: q }));
      // Touch state only when value actually changed.
      if (!q.trim()) return;
    },
    []
  );

  const onFilterChange = React.useCallback(
    (patch: Partial<SearchFilters>) => {
      setFilters((f) => ({ ...f, ...patch }));
    },
    []
  );

  const onResetFilters = React.useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, query: filters.query });
  }, [filters.query]);

  const openDetail = React.useCallback((paper: Paper) => {
    setDetailPaper(paper);
    setDetailOpen(true);
  }, []);

  const onNavigateRelated = React.useCallback(
    (rp: RelatedPaper, source: SourceKey) => {
      const stub: Paper = {
        id: rp.id,
        source,
        title: rp.title,
        abstract: rp.abstract,
        tldr: null,
        authors: rp.authors,
        year: rp.year,
        venue: rp.venue,
        journal: rp.venue,
        doi: null,
        citationCount: rp.citationCount,
        referenceCount: null,
        openAccessPdfUrl: null,
        url: null,
        fieldsOfStudy: [],
        concepts: [],
        publicationTypes: [],
        isOpenAccess: false,
      };
      setDetailPaper(stub);
      // Keep detailOpen true; the new query will refetch the new id.
    },
    []
  );

  const onExport = React.useCallback(
    async (format: "csv" | "bibtex") => {
      if (papers.length === 0) return;
      setExporting(true);
      try {
        const filename = await exportPapers(papers, format);
        toast.success(`Exported ${papers.length} papers as ${filename}`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Export failed.";
        toast.error("Export failed", { description: msg });
      } finally {
        setExporting(false);
      }
    },
    [papers]
  );

  const isHero = !hasQuery;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        savedCount={savedCount}
        onOpenCollections={() => setCollectionsOpen(true)}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-6">
        <SearchBar
          value={filters.query}
          onCommit={onCommitQuery}
          size={isHero ? "hero" : "compact"}
          autoFocus={false}
        />

        <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {/* Desktop filter sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-20 rounded-lg border border-border/60 bg-card">
              <FilterSidebar
                filters={filters}
                onChange={onFilterChange}
                onReset={onResetFilters}
                variant="inline"
              />
            </div>
          </div>

          {/* Main results area */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setFiltersSheetOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
              {hasQuery && (
                <span className="text-xs text-muted-foreground">
                  {totalFound.toLocaleString("en-US")} results
                </span>
              )}
            </div>

            <ResultsTable
              papers={papers}
              loading={
                isSearchLoading || (isSearchFetching && papers.length === 0)
              }
              error={searchError}
              warnings={warnings}
              totalFound={totalFound}
              tookMs={tookMs}
              sourceCounts={sourceCounts}
              hasQuery={hasQuery}
              onOpenDetail={openDetail}
              onExport={onExport}
              exporting={exporting}
            />

            {hasQuery &&
              !isSearchFetching &&
              papers.length > 0 &&
              papers.length < totalFound && (
                <p className="text-center text-xs text-muted-foreground">
                  Showing the first {papers.length} of{" "}
                  {totalFound.toLocaleString("en-US")} matched papers.
                  Refine your filters to narrow further.
                </p>
              )}

            {hasQuery && warnings.length > 0 && papers.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-medium">Some sources had issues:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-2 font-medium text-amber-900 hover:underline dark:text-amber-100"
                  onClick={() => refetchSearch()}
                >
                  Retry search
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <AppFooter />

      {/* Mobile filters sheet */}
      <Sheet
        open={filtersSheetOpen}
        onOpenChange={setFiltersSheetOpen}
      >
        <SheetContent side="left" className="w-full overflow-y-auto p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border/60 p-4">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-emerald-600" />
              Filters
            </SheetTitle>
            <SheetDescription>
              Refine your search across open data sources.
            </SheetDescription>
          </SheetHeader>
          <FilterSidebar
            filters={filters}
            onChange={(patch) => {
              onFilterChange(patch);
            }}
            onReset={onResetFilters}
            variant="sheet"
          />
        </SheetContent>
      </Sheet>

      {/* Saved collections sheet */}
      <CollectionsSheet
        open={collectionsOpen}
        onOpenChange={setCollectionsOpen}
      />

      {/* Paper detail drawer */}
      <PaperDetailDrawer
        paper={detailPaper}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onNavigate={onNavigateRelated}
      />
    </div>
  );
}
