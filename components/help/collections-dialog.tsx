"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteHelpCollection, useReorderHelp, useSaveHelpCollection } from "@/hooks/use-help";
import type { HelpCollection } from "@/types/help";

/** Collections in display order: each top-level one followed by those inside it. */
export function orderedCollections(collections: HelpCollection[]): Array<HelpCollection & { depth: 0 | 1 }> {
  const byOrder = (a: HelpCollection, b: HelpCollection) => a.order - b.order || a.name.localeCompare(b.name);
  const ids = new Set(collections.map((collection) => collection.id));
  const tops = collections.filter((collection) => !collection.parentId || !ids.has(collection.parentId)).sort(byOrder);
  return tops.flatMap((top) => [
    { ...top, depth: 0 as const },
    ...collections
      .filter((child) => child.parentId === top.id)
      .sort(byOrder)
      .map((child) => ({ ...child, depth: 1 as const })),
  ]);
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  slug: string;
  parentId: string;
}

const EMPTY: FormState = { name: "", description: "", slug: "", parentId: "" };

export default function CollectionsDialog({
  open,
  onOpenChange,
  collections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: HelpCollection[];
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const save = useSaveHelpCollection();
  const remove = useDeleteHelpCollection();
  const reorder = useReorderHelp();
  const rows = orderedCollections(collections);
  const tops = rows.filter((row) => row.depth === 0);

  const move = (row: HelpCollection, direction: -1 | 1) => {
    const siblings: HelpCollection[] = rows.filter((other) => (other.parentId ?? "") === (row.parentId ?? ""));
    const index = siblings.findIndex((other) => other.id === row.id);
    const swap = siblings[index + direction];
    if (!swap) return;
    const reordered = [...siblings];
    reordered[index] = swap;
    reordered[index + direction] = row;
    reorder.mutate({ kind: "collections", items: reordered.map((item, order) => ({ id: item.id, order })) });
  };

  const submit = async () => {
    if (!form?.name.trim()) return;
    try {
      await save.mutateAsync({
        id: form.id,
        name: form.name.trim(),
        description: form.description.trim(),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        parentId: form.parentId || null,
      });
      toast.success(form.id ? "Collection saved" : "Collection created");
      setForm(null);
    } catch {
      // The API toast already says why.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Collections</DialogTitle>
        </DialogHeader>
        {form ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                value={form.name}
                maxLength={100}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="collection-description">Description</Label>
              <Textarea
                id="collection-description"
                value={form.description}
                maxLength={300}
                rows={2}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="collection-parent">Inside</Label>
                <select
                  id="collection-parent"
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                  value={form.parentId}
                  onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                >
                  <option value="">Top level</option>
                  {tops
                    .filter((top) => top.id !== form.id)
                    .map((top) => (
                      <option key={top.id} value={top.id}>
                        {top.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label htmlFor="collection-slug">Address</Label>
                <Input
                  id="collection-slug"
                  placeholder="from the name"
                  value={form.slug}
                  onChange={(event) =>
                    setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                  }
                />
                <p className="mt-1 text-xs text-gray-500">/collections/{form.slug || "…"}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>
                Back
              </Button>
              <Button onClick={submit} disabled={!form.name.trim() || save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {form.id ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
              {rows.length === 0 && <li className="p-4 text-sm text-gray-500">No collections yet.</li>}
              {rows.map((row) => {
                const empty = row.articleCount === 0 && !rows.some((other) => other.parentId === row.id);
                return (
                  <li key={row.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className={row.depth ? "min-w-0 flex-1 pl-6" : "min-w-0 flex-1"}>
                      <div className="truncate font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-500">
                        /collections/{row.slug} · {row.publishedCount} published of {row.articleCount}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" title="Move up" onClick={() => move(row, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Move down" onClick={() => move(row, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Edit"
                      onClick={() =>
                        setForm({
                          id: row.id,
                          name: row.name,
                          description: row.description,
                          slug: row.slug,
                          parentId: row.parentId ?? "",
                        })
                      }
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={empty ? "Delete" : "Only an empty collection can be deleted"}
                      disabled={!empty || remove.isPending}
                      onClick={() => remove.mutate(row.id, { onSuccess: () => toast.success(`Deleted ${row.name}`) })}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <DialogFooter>
              <Button onClick={() => setForm(EMPTY)}>
                <Plus /> New collection
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
