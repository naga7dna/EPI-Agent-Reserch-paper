"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type {
  FieldOfStudy,
  SearchFilters,
  SortOption,
  SourceKey,
} from "@/lib/types";
import { currentYear } from "@/lib/format";
import { cn } from "@/lib/utils";

const FIELDS_OF_STUDY: FieldOfStudy[] = [
  "Computer Science",
  "Medicine",
  "Biology",
  "Physics",
  "Mathematics",
  "Chemistry",
  "Economics",
  "Psychology",
  "Sociology",
  "Environmental Science",
  "Engineering",
  "Materials Science",
  "Art",
  "Business",
  "Geography",
  "History",
  "Philosophy",
  "Political Science",
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "citations_desc", label: "Most cited" },
  { value: "citations_asc", label: "Least cited" },
  { value: "year_desc", label: "Newest first" },
  { value: "year_asc", label: "Oldest first" },
];

const PAGE_SIZES = [10, 20, 40];

const DEFAULT_FILTERS: SearchFilters = {
  query: "",
  yearFrom: 1900,
  yearTo: currentYear(),
  fieldOfStudy: "",
  openAccessOnly: false,
  hasAbstract: false,
  minCitations: 0,
  pageSize: 20,
  sort: "relevance",
  sources: ["semantic_scholar", "openalex"],
};

export interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
  /** Inline = desktop sidebar; sheet = rendered inside a mobile Sheet. */
  variant?: "inline" | "sheet";
  className?: string;
}

/**
 * The filter sidebar. Renders the same control tree in two variants:
 * - `inline` for the desktop left rail,
 * - `sheet` for the mobile Filters Sheet (slightly tighter spacing).
 *
 * Text/number inputs (year range, min citations) are debounced 400ms
 * locally and then bubbled up via `onChange` — selects & toggles fire
 * `onChange` immediately.
 */
export function FilterSidebar({
  filters,
  onChange,
  onReset,
  variant = "inline",
  className,
}: FilterSidebarProps) {
  const [yearFrom, setYearFrom] = React.useState<string>(
    filters.yearFrom !== undefined && filters.yearFrom !== null
      ? String(filters.yearFrom)
      : ""
  );
  const [yearTo, setYearTo] = React.useState<string>(
    filters.yearTo !== undefined && filters.yearTo !== null
      ? String(filters.yearTo)
      : ""
  );
  const [minCitations, setMinCitations] = React.useState<string>(
    filters.minCitations !== undefined && filters.minCitations !== null
      ? String(filters.minCitations)
      : ""
  );

  // Keep local text inputs in sync when parent resets or example runs.
  React.useEffect(() => {
    setYearFrom(filters.yearFrom ? String(filters.yearFrom) : "");
  }, [filters.yearFrom]);
  React.useEffect(() => {
    setYearTo(filters.yearTo ? String(filters.yearTo) : "");
  }, [filters.yearTo]);
  React.useEffect(() => {
    setMinCitations(
      filters.minCitations !== undefined && filters.minCitations !== null
        ? String(filters.minCitations)
        : ""
    );
  }, [filters.minCitations]);

  // Debounced push of numeric text fields.
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushNumeric = React.useCallback(
    (patch: Partial<SearchFilters>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(patch), 400);
    },
    [onChange]
  );
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggleSource = (s: SourceKey) => {
    const current = filters.sources ?? [];
    const next = current.includes(s)
      ? current.filter((x) => x !== s)
      : [...current, s];
    onChange({ sources: next.length === 0 ? ["semantic_scholar", "openalex"] : next });
  };

  const isSheet = variant === "sheet";

  return (
    <aside
      className={cn(
        "flex w-full flex-col gap-5",
        isSheet ? "p-1" : "p-4",
        className
      )}
      aria-label="Search filters"
    >
      {!isSheet && (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-emerald-600" />
          Filters
        </div>
      )}

      <section className="flex flex-col gap-2">
        <Label htmlFor="filter-year-from">Year range</Label>
        <div className="flex items-center gap-2">
          <Input
            id="filter-year-from"
            type="number"
            inputMode="numeric"
            min={1900}
            max={currentYear()}
            placeholder="From"
            value={yearFrom}
            onChange={(e) => {
              setYearFrom(e.target.value);
              const parsed = parseInt(e.target.value, 10);
              pushNumeric({
                yearFrom: Number.isNaN(parsed) ? undefined : parsed,
              });
            }}
            className="h-8"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1900}
            max={currentYear()}
            placeholder="To"
            value={yearTo}
            onChange={(e) => {
              setYearTo(e.target.value);
              const parsed = parseInt(e.target.value, 10);
              pushNumeric({
                yearTo: Number.isNaN(parsed) ? undefined : parsed,
              });
            }}
            className="h-8"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="filter-field">Field of study</Label>
        <Select
          value={filters.fieldOfStudy || "any"}
          onValueChange={(v) =>
            onChange({ fieldOfStudy: v === "any" ? "" : (v as FieldOfStudy) })
          }
        >
          <SelectTrigger id="filter-field" className="h-9 w-full">
            <SelectValue placeholder="Any field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any field</SelectItem>
            <SelectGroup>
              <SelectLabel>Fields</SelectLabel>
              {FIELDS_OF_STUDY.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="filter-oa" className="cursor-pointer">
            Open access only
          </Label>
          <Switch
            id="filter-oa"
            checked={!!filters.openAccessOnly}
            onCheckedChange={(c) => onChange({ openAccessOnly: c })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="filter-abstract" className="cursor-pointer">
            Must have abstract
          </Label>
          <Switch
            id="filter-abstract"
            checked={!!filters.hasAbstract}
            onCheckedChange={(c) => onChange({ hasAbstract: c })}
          />
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <Label htmlFor="filter-citations">Minimum citations</Label>
        <Input
          id="filter-citations"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={minCitations}
          onChange={(e) => {
            setMinCitations(e.target.value);
            const parsed = parseInt(e.target.value, 10);
            pushNumeric({
              minCitations: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
            });
          }}
          className="h-8"
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <Label>Sources</Label>
        <div className="flex flex-col gap-2">
          {(
            [
              { key: "semantic_scholar" as const, label: "Semantic Scholar" },
              { key: "openalex" as const, label: "OpenAlex" },
            ]
          ).map(({ key, label }) => {
            const checked = (filters.sources ?? []).includes(key);
            return (
              <Label
                key={key}
                htmlFor={`src-${key}`}
                className="flex cursor-pointer items-center gap-2 font-normal"
              >
                <Checkbox
                  id={`src-${key}`}
                  checked={checked}
                  onCheckedChange={() => toggleSource(key)}
                />
                <span className="text-sm">{label}</span>
              </Label>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <Label htmlFor="filter-sort">Sort by</Label>
        <Select
          value={filters.sort ?? "relevance"}
          onValueChange={(v) => onChange({ sort: v as SortOption })}
        >
          <SelectTrigger id="filter-sort" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="filter-pagesize">Results per page</Label>
        <Select
          value={String(filters.pageSize ?? 20)}
          onValueChange={(v) => onChange({ pageSize: parseInt(v, 10) })}
        >
          <SelectTrigger id="filter-pagesize" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} results
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
        onClick={onReset}
      >
        <RotateCcw className="size-3.5" />
        Reset filters
      </Button>
    </aside>
  );
}

export { DEFAULT_FILTERS };
