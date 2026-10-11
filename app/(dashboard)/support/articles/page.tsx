"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, ExternalLink, FolderTree, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import SupportMeGate from "@/components/support/support-me-gate";
import CollectionsDialog, { orderedCollections } from "@/components/help/collections-dialog";
import { ArticleStatus, FeedbackScore, HELP_SITE_URL, personName, shortDate } from "@/components/help/help-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue, useHelpArticles, useHelpCollections, useReorderHelp } from "@/hooks/use-help";
import { createHelpArticle, listHelpRedirects } from "@/lib/help-api";
import { cn } from "@/lib/utils";
import {
  HELP_AUDIENCE_LABELS,
  HELP_AUDIENCES,
  HELP_STATUS_FILTERS,
  type HelpArticleQuery,
  type HelpAudience,
  type HelpStatusFilter,
} from "@/types/help";

const STATUS_LABELS: Record<HelpStatusFilter, string> = {
  all: "All",
  draft: "Drafts",
  published: "Published",
  changed: "Unpublished changes",
  stale: "Needs review",
  archived: "Archived",
};

function isStatus(value: string | null): value is HelpStatusFilter {
  return !!value && (HELP_STATUS_FILTERS as readonly string[]).includes(value);
}

function isAudience(value: string | null): value is HelpAudience {
  return !!value && (HELP_AUDIENCES as readonly string[]).includes(value);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function NewArticleDialog({
  open,
  onOpenChange,
  collections,
  defaultCollection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: ReturnType<typeof orderedCollections>;
  defaultCollection: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [collectionId, setCollectionId] = useState(defaultCollection);
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const article = await createHelpArticle({ title: title.trim(), collectionId: collectionId || null });
      router.push(`/support/articles/${article.id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New article</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-title">Title</Label>
            <Input
              id="new-title"
              value={title}
              maxLength={150}
              autoFocus
              placeholder="How to add your card to Apple Pay"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void create()}
            />
          </div>
          <div>
            <Label htmlFor="new-collection">Collection</Label>
            <select
              id="new-collection"
              className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
            >
              <option value="">No collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.depth ? "— " : ""}
                  {collection.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!title.trim() || creating}>
            {creating && <Loader2 className="animate-spin" />}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The help center's articles: what is live, what is waiting to be published,
 * and what nobody has checked in six months. Filters live in the URL.
 */
function ArticlesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status: HelpStatusFilter = isStatus(params.get("status")) ? (params.get("status") as HelpStatusFilter) : "all";
  const collection = params.get("collection") ?? "";
  const audience = isAudience(params.get("audience")) ? (params.get("audience") as HelpAudience) : undefined;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebouncedValue(search.trim(), 250);
  const [showCollections, setShowCollections] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const reorder = useReorderHelp();

  const query: HelpArticleQuery = useMemo(
    () => ({
      ...(status !== "all" ? { status } : {}),
      ...(collection ? { collectionId: collection } : {}),
      ...(q ? { q } : {}),
      ...(audience ? { audience } : {}),
    }),
    [status, collection, q, audience],
  );
  const { data, isLoading, isFetching } = useHelpArticles(query);
  const { data: collections = [] } = useHelpCollections();
  const ordered = useMemo(() => orderedCollections(collections), [collections]);
  const collectionName = useMemo(() => new Map(collections.map((row) => [row.id, row.name])), [collections]);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Within one collection, sorted by its order: rows can move up and down.
  const rows = useMemo(() => {
    const articles = data?.articles ?? [];
    if (!collection || collection === "none") return articles;
    return [...articles].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }, [data, collection]);
  const canReorder = Boolean(collection && collection !== "none" && !q && status === "all" && !audience);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ kind: "articles", items: next.map((row, order) => ({ id: row.id, order })) });
  };

  const downloadRedirects = async () => {
    try {
      const redirects = await listHelpRedirects();
      const csv = ["from,to,kind", ...redirects.map((row) => [row.from, row.to, row.kind].map(csvCell).join(","))].join(
        "\n",
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "help-center-redirects.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not load the redirect map");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Help Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Articles on {HELP_SITE_URL.replace(/^https?:\/\//, "")}, in the app, and behind Solid AI&apos;s answers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={HELP_SITE_URL} target="_blank" rel="noreferrer">
              <ExternalLink /> View site
            </a>
          </Button>
          <Button variant="outline" onClick={downloadRedirects} title="Old Intercom and renamed URLs, and where they go">
            <Download /> Redirect map
          </Button>
          <Button variant="outline" onClick={() => setShowCollections(true)}>
            <FolderTree /> Collections
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus /> New article
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {HELP_STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => update({ status: value === "all" ? null : value })}
            className={cn(
              "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium",
              status === value
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {STATUS_LABELS[value]}
            {data?.counts && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{data.counts[value]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Search titles"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              update({ q: event.target.value.trim() || null });
            }}
          />
        </div>
        <select
          aria-label="Collection"
          className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
          value={collection}
          onChange={(event) => update({ collection: event.target.value || null })}
        >
          <option value="">All collections</option>
          <option value="none">No collection</option>
          {ordered.map((row) => (
            <option key={row.id} value={row.id}>
              {row.depth ? "— " : ""}
              {row.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Audience"
          className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
          value={audience ?? ""}
          onChange={(event) => update({ audience: event.target.value || null })}
        >
          <option value="">Any audience</option>
          {HELP_AUDIENCES.map((value) => (
            <option key={value} value={value}>
              {HELP_AUDIENCE_LABELS[value]}
            </option>
          ))}
        </select>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {canReorder && <th className="w-16 px-3 py-2" />}
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Collection</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Audience</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2" title="Readers who said it answered their question">
                Helpful
              </th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-indigo-600" />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-gray-500">
                  No articles here.
                </td>
              </tr>
            )}
            {rows.map((article, index) => (
              <tr key={article.id} className="border-t border-gray-100 hover:bg-gray-50">
                {canReorder && (
                  <td className="px-2 py-2">
                    <div className="flex">
                      <Button variant="ghost" size="icon-xs" title="Move up" onClick={() => move(index, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-xs" title="Move down" onClick={() => move(index, 1)}>
                        <ArrowDown />
                      </Button>
                    </div>
                  </td>
                )}
                <td className="max-w-md px-3 py-2">
                  <Link href={`/support/articles/${article.id}`} className="font-medium text-gray-900 hover:text-indigo-700">
                    {article.title}
                  </Link>
                  <div className="truncate text-xs text-gray-500">/articles/{article.slug}</div>
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {article.collectionId ? (collectionName.get(article.collectionId) ?? "—") : <span className="text-gray-400">None</span>}
                </td>
                <td className="px-3 py-2">
                  <ArticleStatus article={article} />
                </td>
                <td className="px-3 py-2">
                  {article.audience === "public" ? (
                    <span className="text-gray-700">Everyone</span>
                  ) : (
                    <Badge variant={article.audience === "internal" ? "info" : "muted"}>
                      {HELP_AUDIENCE_LABELS[article.audience]}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700">{personName(article.ownerEmail)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">{shortDate(article.verifiedAt)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <FeedbackScore {...article.feedback} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {shortDate(article.updatedAt)} · {personName(article.updatedBy)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CollectionsDialog open={showCollections} onOpenChange={setShowCollections} collections={collections} />
      {showNew && (
        <NewArticleDialog
          open={showNew}
          onOpenChange={setShowNew}
          collections={ordered}
          defaultCollection={collection && collection !== "none" ? collection : ""}
        />
      )}
    </div>
  );
}

export default function HelpArticlesPage() {
  return (
    <SupportMeGate>
      {() => (
        <Suspense fallback={null}>
          <ArticlesScreen />
        </Suspense>
      )}
    </SupportMeGate>
  );
}
