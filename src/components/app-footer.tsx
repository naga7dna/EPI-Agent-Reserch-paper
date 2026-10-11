"use client";

import * as React from "react";
import { Database, FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearHistory } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";

const SOURCES = [
  { name: "Semantic Scholar", url: "https://www.semanticscholar.org/" },
  { name: "OpenAlex", url: "https://openalex.org/" },
  { name: "Crossref", url: "https://www.crossref.org/" },
];

export function AppFooter() {
  const qc = useQueryClient();
  const clearHistoryMut = useMutation({
    mutationFn: () => clearHistory(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.history() });
      toast.success("Search history cleared.");
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to clear history.";
      toast.error("Couldn't clear history", { description: msg });
    },
  });

  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="size-4 text-emerald-600" />
            ScholarSift
          </div>
          <p className="text-xs text-muted-foreground">
            Built with open data. No API keys required.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Database className="size-3.5 text-emerald-600" />
            Data sources:
          </span>
          {SOURCES.map((s, i) => (
            <React.Fragment key={s.name}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground/80 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400"
              >
                {s.name}
              </a>
              {i < SOURCES.length - 1 && <Separator orientation="vertical" className="h-3" />}
            </React.Fragment>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 self-start text-muted-foreground md:self-auto"
          onClick={() => clearHistoryMut.mutate()}
          disabled={clearHistoryMut.isPending}
        >
          <Trash2 className="size-3.5" />
          Clear search history
        </Button>
      </div>
    </footer>
  );
}
