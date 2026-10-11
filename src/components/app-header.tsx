"use client";

import * as React from "react";
import { BookOpen, Bookmark, Github, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Sticky app header. The "Saved" button is a regular button that calls
 * `onOpenCollections`; the parent owns the Sheet.
 */
export function AppHeader({
  savedCount = 0,
  onOpenCollections,
}: {
  savedCount?: number;
  onOpenCollections?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <BookOpen className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <a
              href="/"
              className="text-base font-semibold tracking-tight"
              aria-label="ScholarSift home"
            >
              ScholarSift
            </a>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Open academic search · no API keys required
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="About ScholarSift"
                asChild
              >
                <a
                  href="https://www.semanticscholar.org/product/api"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Info className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>About the open data sources</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="View project source on GitHub"
                asChild
              >
                <a
                  href="https://github.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open-source on GitHub</TooltipContent>
          </Tooltip>

          <ThemeToggle />

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={onOpenCollections}
          >
            <Bookmark className="size-4" />
            <span className="hidden sm:inline">Saved</span>
            {savedCount > 0 && (
              <span className="ml-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {savedCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
