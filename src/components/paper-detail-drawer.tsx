"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  FileText,
  Loader2,
  Quote,
  Star,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SourceBadge } from "@/components/source-badge";
import { SavePaperDialog } from "@/components/save-paper-dialog";
import { fetchPaperDetail } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  Paper,
  PaperDetail,
  RelatedPaper,
  SourceKey,
} from "@/lib/types";
import {
  doiUrl,
  formatAuthors,
  formatNumber,
  formatYear,
  truncate,
} from "@/lib/format";

interface PaperDetailDrawerProps {
  paper: Paper | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (paper: RelatedPaper, source: SourceKey) => void;
}

export function PaperDetailDrawer({
  paper,
  open,
  onOpenChange,
  onNavigate,
}: PaperDetailDrawerProps) {
  const [notes, setNotes] = React.useState("");

  // Reset notes when the active paper changes.
  React.useEffect(() => {
    setNotes("");
  }, [paper?.id]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: qk.paper(paper?.id ?? "", paper?.source ?? ""),
    queryFn: () => fetchPaperDetail(paper!.id, paper!.source, paper!.doi),
    enabled: !!paper && open,
    staleTime: 60_000,
  });

  const detail = (data ?? paper ?? null) as PaperDetail | Paper | null;
  const references: RelatedPaper[] =
    (detail && "references" in detail ? detail.references : []) ?? [];
  const citedBy: RelatedPaper[] =
    (detail && "citations" in detail ? detail.citations : []) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="gap-2 border-b border-border/60 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {paper && <SourceBadge source={paper.source} />}
            {paper?.year && (
              <Badge variant="outline" className="tabular-nums">
                {formatYear(paper.year)}
              </Badge>
            )}
            {paper && paper.isOpenAccess && (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
                Open Access
              </Badge>
            )}
            {paper && (
              <Badge variant="secondary" className="tabular-nums">
                {formatNumber(paper.citationCount)} citations
              </Badge>
            )}
          </div>
          <SheetTitle className="text-balance text-lg leading-snug sm:text-xl">
            {paper?.title ?? "Paper"}
          </SheetTitle>
          <SheetDescription className="text-sm">
            {paper && formatAuthors(paper.authors).full}
            {paper?.venue ? ` · ${paper.venue}` : ""}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="custom-scrollbar flex-1">
          <div className="flex flex-col gap-5 p-5">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading paper details…
              </div>
            )}
            {isError && (
              <p className="text-sm text-destructive">
                Couldn&apos;t load paper detail:{" "}
                {error instanceof Error ? error.message : "Unknown error."}
              </p>
            )}

            {detail && (
              <>
                {detail.abstract && (
                  <section className="flex flex-col gap-2">
                    <SectionTitle icon={<BookOpen className="size-4" />}>
                      Abstract
                    </SectionTitle>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {detail.abstract}
                    </p>
                  </section>
                )}

                {detail.tldr && (
                  <section className="flex flex-col gap-2">
                    <SectionTitle icon={<Quote className="size-4" />}>
                      TL;DR
                    </SectionTitle>
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                      {detail.tldr}
                    </p>
                  </section>
                )}

                {(detail.fieldsOfStudy?.length > 0 ||
                  detail.concepts?.length > 0) && (
                  <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {detail.fieldsOfStudy?.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <SectionTitle>Fields of study</SectionTitle>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.fieldsOfStudy.map((f) => (
                            <Badge
                              key={f}
                              variant="outline"
                              className="text-emerald-700 dark:text-emerald-300"
                            >
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {detail.concepts?.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <SectionTitle>Concepts</SectionTitle>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.concepts.map((c) => (
                            <Badge key={c.name} variant="secondary">
                              {c.name}
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {Math.round((c.score ?? 0) * 100)}%
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat
                    label="Citations"
                    value={formatNumber(detail.citationCount)}
                  />
                  <Stat
                    label="References"
                    value={formatNumber(
                      detail.referenceCount ?? references.length
                    )}
                  />
                  <Stat label="Year" value={formatYear(detail.year)} />
                  <Stat
                    label="Venue"
                    value={truncate(
                      detail.venue ?? detail.journal ?? "—",
                      30
                    )}
                  />
                </section>

                {detail.doi && (
                  <section className="flex flex-col gap-1 text-sm">
                    <SectionTitle>DOI</SectionTitle>
                    {(() => {
                      const url = doiUrl(detail.doi);
                      return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          <ArrowUpRight className="size-3.5" />
                          {detail.doi}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          {detail.doi}
                        </span>
                      );
                    })()}
                  </section>
                )}

                <section className="flex flex-wrap items-center gap-2">
                  {detail.openAccessPdfUrl && (
                    <Button
                      asChild
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <a
                        href={detail.openAccessPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText className="size-4" />
                        Open PDF
                      </a>
                    </Button>
                  )}
                  {detail.url && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <a
                        href={detail.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-4" />
                        View on source
                      </a>
                    </Button>
                  )}
                  {paper && (
                    <SavePaperDialog
                      paper={paper}
                      align="end"
                      defaultNotes={notes}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Star className="size-4" />
                        Save
                      </Button>
                    </SavePaperDialog>
                  )}
                </section>

                {/* Notes editor: values are pre-filled into the save popover. */}
                <section className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/30 p-3">
                  <Label htmlFor="detail-notes">
                    Notes for this paper
                  </Label>
                  <Textarea
                    id="detail-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Type a note about why this paper matters — it will be carried into the save dialog below."
                    className="min-h-20 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Notes are persisted with the saved record inside the
                    collection you pick when saving.
                  </p>
                  {paper && (
                    <SavePaperDialog
                      paper={paper}
                      align="start"
                      defaultNotes={notes}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start gap-1.5"
                      >
                        <Star className="size-3.5" />
                        Save to collection
                      </Button>
                    </SavePaperDialog>
                  )}
                </section>

                {/* References / Cited-by */}
                <Tabs defaultValue="references" className="w-full">
                  <TabsList>
                    <TabsTrigger value="references">
                      References ({references.length})
                    </TabsTrigger>
                    <TabsTrigger value="citedby">
                      Cited by ({citedBy.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="references">
                    <RelatedList
                      items={references}
                      source={paper?.source ?? "semantic_scholar"}
                      onNavigate={(rp) =>
                        onNavigate(rp, paper?.source ?? "semantic_scholar")
                      }
                    />
                  </TabsContent>
                  <TabsContent value="citedby">
                    <RelatedList
                      items={citedBy}
                      source={paper?.source ?? "semantic_scholar"}
                      onNavigate={(rp) =>
                        onNavigate(rp, paper?.source ?? "semantic_scholar")
                      }
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h4>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border/60 bg-muted/30 p-2.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm font-semibold">{value}</span>
    </div>
  );
}

function RelatedList({
  items,
  onNavigate,
}: {
  items: RelatedPaper[];
  source: SourceKey;
  onNavigate: (rp: RelatedPaper) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No related papers returned by the source.
      </p>
    );
  }
  return (
    <ScrollArea className="custom-scrollbar max-h-96">
      <ul className="flex flex-col divide-y divide-border/60">
        {items.map((rp) => {
          const { short } = formatAuthors(rp.authors);
          return (
            <li key={rp.id}>
              <button
                type="button"
                onClick={() => onNavigate(rp)}
                className="flex w-full flex-col gap-1 px-1 py-2.5 text-left transition-colors hover:bg-accent/50"
              >
                <span className="text-sm font-medium leading-snug">
                  {rp.title || "Untitled"}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{short}</span>
                  {rp.year && <span>· {rp.year}</span>}
                  <span>· {formatNumber(rp.citationCount)} citations</span>
                  {rp.venue && (
                    <span className="truncate">· {truncate(rp.venue, 60)}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
