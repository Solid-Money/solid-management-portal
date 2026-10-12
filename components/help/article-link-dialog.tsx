"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue, useHelpArticles } from "@/hooks/use-help";
import type { HelpArticleSummary } from "@/types/help";

/** Pick another article to link to; the link is `/articles/<slug>`, which keeps working if it is renamed. */
export default function ArticleLinkDialog({
  open,
  onOpenChange,
  onPick,
  excludeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (article: HelpArticleSummary) => void;
  excludeId: string;
}) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 200);
  const { data, isFetching } = useHelpArticles({ status: "published", ...(q ? { q } : {}) });
  const articles = (data?.articles ?? []).filter((article) => article.id !== excludeId).slice(0, 30);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to an article</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8"
            autoFocus
            placeholder="Search published articles"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
          {isFetching && !data && (
            <li className="p-4">
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" />
            </li>
          )}
          {data && articles.length === 0 && <li className="p-4 text-sm text-gray-500">No published article matches.</li>}
          {articles.map((article) => (
            <li key={article.id}>
              <button
                type="button"
                className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => {
                  onPick(article);
                  onOpenChange(false);
                }}
              >
                <div className="font-medium text-gray-900">{article.title}</div>
                <div className="text-xs text-gray-500">/articles/{article.slug}</div>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
