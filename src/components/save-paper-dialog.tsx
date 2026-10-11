"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Check, FolderPlus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { SourceBadge } from "@/components/source-badge";
import {
  fetchCollections,
  createCollection,
  savePaperToCollection,
} from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { CollectionColor, Paper } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS: { value: CollectionColor; className: string }[] = [
  { value: "slate", className: "bg-slate-500" },
  { value: "rose", className: "bg-rose-500" },
  { value: "emerald", className: "bg-emerald-500" },
  { value: "amber", className: "bg-amber-500" },
  { value: "violet", className: "bg-violet-500" },
  { value: "cyan", className: "bg-cyan-500" },
];

function dot(color: CollectionColor | null | undefined): string {
  return (
    COLORS.find((c) => c.value === color)?.className ?? "bg-slate-400"
  );
}

/**
 * Inline save-to-collection popover.
 *
 * Lists existing collections, lets the user pick one (POSTs the paper),
 * and supports creating a brand-new collection without leaving the popover.
 *
 * `defaultNotes` lets the parent pre-fill notes from the detail drawer.
 */
export interface SavePaperDialogProps {
  paper: Paper;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  defaultNotes?: string;
  onSaved?: () => void;
  align?: "center" | "start" | "end";
}

export function SavePaperDialog({
  paper,
  children,
  defaultOpen = false,
  defaultNotes = "",
  onSaved,
  align = "center",
}: SavePaperDialogProps) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(defaultOpen);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState<CollectionColor>("emerald");
  const [newDesc, setNewDesc] = React.useState("");
  const [notes, setNotes] = React.useState(defaultNotes);

  // Track which collections already have this paper (best-effort by externalId).
  const { data: collections = [], isFetching } = useQuery({
    queryKey: qk.collections(),
    queryFn: fetchCollections,
    enabled: open,
  });

  // Track which collections already have this paper (optimistic — updated
  // after a successful save inside this popover instance).
  const [savedIn, setSavedIn] = React.useState<Record<string, boolean>>({});

  // Keep `notes` in sync with `defaultNotes` from the parent (e.g. the
  // detail drawer lets the user type notes there before opening this).
  React.useEffect(() => {
    setNotes(defaultNotes);
  }, [defaultNotes]);

  const createMut = useMutation({
    mutationFn: () =>
      createCollection({
        name: newName.trim(),
        color: newColor,
        description: newDesc.trim() || undefined,
      }),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: qk.collections() });
      toast.success(`Collection "${created.name}" created.`);
      // Immediately save the paper into the freshly created collection.
      saveMut.mutate({ collectionId: created.id, paper, notes });
      setCreating(false);
      setNewName("");
      setNewDesc("");
      setNewColor("emerald");
      setNotes("");
      setOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create.";
      toast.error("Couldn't create collection", { description: msg });
    },
  });

  const saveMut = useMutation({
    mutationFn: ({
      collectionId,
      paper,
      notes,
    }: {
      collectionId: string;
      paper: Paper;
      notes?: string;
    }) => savePaperToCollection(collectionId, { collectionId, paper, notes }),
    onSuccess: async (_data, vars) => {
      const col = collections.find((c) => c.id === vars.collectionId);
      toast.success(`Saved to "${col?.name ?? "collection"}".`);
      await qc.invalidateQueries({ queryKey: qk.collections() });
      await qc.invalidateQueries({
        queryKey: qk.collectionPapers(vars.collectionId),
      });
      setSavedIn((prev) => ({ ...prev, [vars.collectionId]: true }));
      onSaved?.();
      setOpen(false);
      setNotes("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      toast.error("Couldn't save paper", { description: msg });
    },
  });

  const handlePick = (collectionId: string) => {
    saveMut.mutate({ collectionId, paper, notes: notes || undefined });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Save paper to a collection"
          >
            <Star className="size-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Save paper</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {paper.title}
              </span>
            </div>
            <SourceBadge source={paper.source} />
          </div>

          <Separator className="my-1" />

          {!creating ? (
            <>
              <div className="flex flex-col gap-1">
                {collections.length === 0 && !isFetching && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    No collections yet. Create one to start saving papers.
                  </p>
                )}
                {collections.map((c) => {
                  const already = !!savedIn[c.id];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handlePick(c.id)}
                      disabled={saveMut.isPending}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          dot(c.color)
                        )}
                      />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.paperCount}
                      </span>
                      {already && (
                        <Check className="size-4 text-emerald-600" />
                      )}
                    </button>
                  );
                })}
              </div>
              <Separator className="my-1" />
              <div className="flex flex-col gap-2">
                <Label htmlFor="save-notes">Notes (optional)</Label>
                <Textarea
                  id="save-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note about why this paper is relevant…"
                  className="min-h-16 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 gap-1.5"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                New collection
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FolderPlus className="size-3.5" />
                New collection
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Thesis references"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="new-desc">Description</Label>
                <Input
                  id="new-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Color</Label>
                <div className="flex items-center gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewColor(c.value)}
                      className={cn(
                        "size-6 rounded-full ring-offset-2 ring-offset-background transition-all",
                        c.className,
                        newColor === c.value
                          ? "ring-2 ring-ring"
                          : "hover:scale-110"
                      )}
                      aria-label={`${c.value} color`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={!newName.trim() || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? "Creating…" : "Create & save"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
