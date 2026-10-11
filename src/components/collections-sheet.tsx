"use client";

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  FolderPlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CollectionDetailPanel } from "@/components/collection-detail-panel";
import {
  fetchCollections,
  createCollection,
  deleteCollection,
} from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { CollectionColor } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
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

export interface CollectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "Saved" sheet. Renders the collections list and a quick create form.
 * When a collection is selected, the inner view swaps to `CollectionDetailPanel`
 * with a back chevron at the top.
 */
export function CollectionsSheet({
  open,
  onOpenChange,
}: CollectionsSheetProps) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newColor, setNewColor] = React.useState<CollectionColor>("emerald");

  const { data: collections = [], isLoading } = useQuery({
    queryKey: qk.collections(),
    queryFn: fetchCollections,
    enabled: open,
  });

  // Clear selection when sheet closes.
  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setSelectedId(null), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: () =>
      createCollection({
        name: newName.trim(),
        color: newColor,
        description: newDesc.trim() || undefined,
      }),
    onSuccess: async (c) => {
      await qc.invalidateQueries({ queryKey: qk.collections() });
      toast.success(`Collection "${c.name}" created.`);
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setNewColor("emerald");
      setSelectedId(c.id);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Couldn't create.";
      toast.error("Couldn't create collection", { description: msg });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.collections() });
      toast.success("Collection deleted.");
      setSelectedId(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Couldn't delete.";
      toast.error("Couldn't delete collection", { description: msg });
    },
  });

  const selected = collections.find((c) => c.id === selectedId) ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl lg:max-w-2xl"
      >
        {selected ? (
          <>
          <SheetHeader className="flex flex-row items-center gap-2 border-b border-border/60 p-4">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setSelectedId(null)}
                aria-label="Back to collections"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      dot(selected.color)
                    )}
                  />
                  <SheetTitle className="text-base">
                    {selected.name}
                  </SheetTitle>
                </div>
                {selected.description && (
                  <SheetDescription className="text-xs">
                    {selected.description}
                  </SheetDescription>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label="Delete collection"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete collection?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove &quot;{selected.name}&quot;
                      and all {selected.paperCount} saved paper
                      {selected.paperCount === 1 ? "" : "s"} inside it. This
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMut.mutate(selected.id)}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetHeader>
            <CollectionDetailPanel collectionId={selected.id} />
          </>
        ) : (
          <>
            <SheetHeader className="gap-1 border-b border-border/60 p-4">
              <SheetTitle className="flex items-center gap-2">
                Saved collections
              </SheetTitle>
              <SheetDescription>
                Curate your reading lists. Papers are stored locally so they
                stick around across sessions.
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="custom-scrollbar flex-1">
              <div className="flex flex-col gap-2 p-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 self-start"
                  onClick={() => setShowCreate((v) => !v)}
                >
                  <Plus className="size-4" />
                  New collection
                </Button>

                {showCreate && (
                  <div className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FolderPlus className="size-3.5" />
                      New collection
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="col-name">Name</Label>
                      <Input
                        id="col-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Thesis references"
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="col-desc">Description</Label>
                      <Input
                        id="col-desc"
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
                        onClick={() => setShowCreate(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={!newName.trim() || createMut.isPending}
                        onClick={() => createMut.mutate()}
                      >
                        {createMut.isPending ? "Creating…" : "Create"}
                      </Button>
                    </div>
                  </div>
                )}

                <Separator className="my-1" />

                {isLoading && (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading collections…
                  </div>
                )}
                {!isLoading && collections.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No collections yet. Create one above to start saving
                    papers.
                  </p>
                )}
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="flex w-full items-center gap-3 rounded-md border border-border/60 bg-card p-3 text-left transition-colors hover:border-emerald-500/50 hover:bg-accent/50"
                  >
                    <span
                      className={cn("size-3 shrink-0 rounded-full", dot(c.color))}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {c.name}
                      </span>
                      {c.description && (
                        <span className="truncate text-xs text-muted-foreground">
                          {c.description}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {c.paperCount} paper
                        {c.paperCount === 1 ? "" : "s"} · created{" "}
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
