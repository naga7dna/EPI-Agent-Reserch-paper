import { Database, BookOpen } from "lucide-react";
import type { SourceKey } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: SourceKey | "crossref" | string;
  className?: string;
  count?: number;
  withLabel?: boolean;
}

const META: Record<
  string,
  { label: string; short: string; className: string }
> = {
  semantic_scholar: {
    label: "Semantic Scholar",
    short: "S2",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
  openalex: {
    label: "OpenAlex",
    short: "OA",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  crossref: {
    label: "Crossref",
    short: "CR",
    className:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900",
  },
};

export function SourceBadge({
  source,
  className,
  count,
  withLabel = false,
}: SourceBadgeProps) {
  const meta = META[source] ?? {
    label: String(source),
    short: String(source).slice(0, 2).toUpperCase(),
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        meta.className,
        className
      )}
      title={meta.label}
    >
      {source === "semantic_scholar" ? (
        <BookOpen className="size-3" />
      ) : (
        <Database className="size-3" />
      )}
      <span className="uppercase">{withLabel ? meta.label : meta.short}</span>
      {typeof count === "number" && (
        <span className="opacity-70">·{count.toLocaleString("en-US")}</span>
      )}
    </span>
  );
}
