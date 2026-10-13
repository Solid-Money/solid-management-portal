"use client";

import { useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FeedbackScore, personName, shortDate } from "@/components/help/help-format";
import { useHelpVersion, useHelpVersions } from "@/hooks/use-help";

/**
 * Every published version, newest first. Versions never change: Solid AI's
 * citations and readers' votes point at them. Restoring copies one back into
 * the working copy; it goes live on the next publish.
 */
export default function VersionsPanel({
  articleId,
  onRestore,
  restoring,
}: {
  articleId: string;
  onRestore: (number: number) => void;
  restoring: boolean;
}) {
  const { data: versions, isLoading } = useHelpVersions(articleId);
  const [viewing, setViewing] = useState<number | null>(null);
  const { data: version, isLoading: loadingVersion } = useHelpVersion(articleId, viewing);

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <History className="h-4 w-4 text-gray-400" /> Versions
      </h2>
      {isLoading && <Loader2 className="mt-3 h-4 w-4 animate-spin text-gray-400" />}
      {versions && versions.length === 0 && <p className="mt-2 text-sm text-gray-500">Not published yet.</p>}
      <ul className="mt-2 space-y-1">
        {versions?.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setViewing(row.number)}
              className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">v{row.number}</span>
                {row.live && <Badge variant="success">Live</Badge>}
                <span className="ml-auto text-xs">
                  <FeedbackScore {...row.feedback} />
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {shortDate(row.publishedAt)} · {personName(row.publishedBy)}
              </div>
              {row.note && <div className="truncate text-xs text-gray-600">{row.note}</div>}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Version {viewing}
              {version && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {shortDate(version.publishedAt)} · {personName(version.publishedBy)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {loadingVersion || !version ? (
            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-indigo-600" />
          ) : (
            <div>
              {version.note && <p className="mb-3 rounded-md bg-gray-50 p-2 text-sm text-gray-700">{version.note}</p>}
              <h1 className="mb-2 text-2xl font-bold text-gray-900">{version.title}</h1>
              {version.description && <p className="mb-4 text-gray-600">{version.description}</p>}
              <div className="help-prose" dangerouslySetInnerHTML={{ __html: version.html }} />
            </div>
          )}
          <DialogFooter>
            {version && !version.live && (
              <Button
                variant="outline"
                disabled={restoring}
                onClick={() => {
                  onRestore(version.number);
                  setViewing(null);
                }}
              >
                <RotateCcw /> Restore into the editor
              </Button>
            )}
            <Button onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
