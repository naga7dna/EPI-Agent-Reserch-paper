"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "CRISPR gene editing",
  "large language model reasoning",
  "climate change adaptation",
  "quantum error correction",
  "GLP-1 receptor agonists",
];

export interface SearchBarProps {
  value: string;
  onCommit: (q: string) => void;
  size?: "hero" | "compact";
  autoFocus?: boolean;
  className?: string;
}

/**
 * Search input with example query chips.
 *
 * - The text input keeps a local shadow state so typing feels instant.
 * - On each keystroke we (re)start a 400ms debounce timer; when it fires
 *   we commit the value up to the parent (which triggers a search).
 * - Pressing Enter commits immediately (and cancels the pending debounce).
 */
export function SearchBar({
  value,
  onCommit,
  size = "compact",
  autoFocus = false,
  className,
}: SearchBarProps) {
  const [local, setLocal] = React.useState(value);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the local shadow state in sync if the parent's value changes
  // (e.g. example chip click or reset).
  React.useEffect(() => {
    setLocal(value);
  }, [value]);

  const scheduleCommit = React.useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onCommit(q);
      }, 400);
    },
    [onCommit]
  );

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const commitNow = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onCommit(q);
  };

  const isHero = size === "hero";

  return (
    <section
      className={cn(
        "flex w-full flex-col items-center gap-4",
        isHero ? "py-10 sm:py-16" : "py-2",
        className
      )}
    >
      <div className={cn("w-full text-center", isHero && "max-w-3xl")}>
        {isHero && (
          <h1 className="mb-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Search the{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              open academic web
            </span>
          </h1>
        )}
        {isHero && (
          <p className="mb-6 text-balance text-sm text-muted-foreground sm:text-base">
            Structured columns across Semantic Scholar & OpenAlex — no API
            keys, no rate limits, no AI black boxes.
          </p>
        )}

        <form
          className={cn(
            "mx-auto flex w-full items-center gap-2",
            isHero ? "max-w-2xl" : "max-w-full"
          )}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            commitNow(local);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={local}
              autoFocus={autoFocus}
              onChange={(e) => {
                setLocal(e.target.value);
                scheduleCommit(e.target.value);
              }}
              placeholder="Search 200M+ papers across Semantic Scholar & OpenAlex — e.g. 'transformer attention mechanisms'"
              aria-label="Search papers"
              className={cn(
                "h-11 pl-9 pr-9",
                isHero && "h-12 text-base sm:text-base"
              )}
            />
            {local && (
              <button
                type="button"
                onClick={() => {
                  setLocal("");
                  commitNow("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            size={isHero ? "lg" : "default"}
            className={cn(
              "gap-2 bg-emerald-600 text-white hover:bg-emerald-700",
              isHero && "h-12"
            )}
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </form>
      </div>

      {isHero && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setLocal(ex);
                commitNow(ex);
              }}
              className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-emerald-500/60 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
