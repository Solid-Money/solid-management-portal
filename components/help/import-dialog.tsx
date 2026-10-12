"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { personName } from "@/components/help/help-format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HELP_KEYS, useHelpImport, useStartHelpImport } from "@/hooks/use-help";
import { formatDateTime } from "@/lib/utils";
import type { HelpImportReport, HelpImportRun } from "@/types/help";

/** The report's totals in plain words, for a preview or a real run. */
function summaryRows(report: HelpImportReport): Array<{ label: string; value: number; hint?: string }> {
  const t = report.totals;
  const left = Object.entries(t)
    .filter(([key]) => key.startsWith("skipped"))
    .reduce((sum, [, value]) => sum + value, 0);
  const preview = report.dryRun;
  const rows: Array<{ label: string; value: number; hint?: string }> = [
    { label: "Articles in Intercom", value: t.intercom_articles ?? 0 },
    { label: preview ? "Would be published" : "Published", value: (preview ? t.would_publish : t.published) ?? 0 },
    {
      label: preview ? "Would come in as drafts" : "Drafts",
      value: (preview ? t.would_draft : t.draft) ?? 0,
      hint: "Intercom drafts. They stay drafts here, not public.",
    },
    { label: "Already here, left alone", value: t.exists ?? 0, hint: "Matched by their Intercom id. Edits made here are kept." },
    { label: "Redone", value: t.replaced ?? 0 },
    {
      label: "Left out",
      value: left,
      hint: "Empty articles, ones marked superseded, merged or deprecated, and drafts that duplicate a published article. Their old links redirect.",
    },
    {
      label: preview ? "New collections" : "Collections created",
      value: report.collections.filter((row) => row.action !== "exists").length,
    },
  ];
  if (!preview) rows.push({ label: "Images copied", value: report.images.rehosted });
  return rows.filter((row) => row.value > 0 || row.label.startsWith("Articles"));
}

function RunSummary({ run }: { run: HelpImportRun }) {
  const what = run.dryRun ? "Preview" : "Import";
  const who = run.startedBy.name || personName(run.startedBy.email);
  const when = formatDateTime(run.startedAt);
  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-3 text-sm">
      <div className="flex items-center gap-2">
        {run.status === "running" && <Loader2 className="size-4 animate-spin text-indigo-600" />}
        {run.status === "done" && <CheckCircle2 className="size-4 text-green-600" />}
        {run.status === "failed" && <XCircle className="size-4 text-red-600" />}
        <span className="font-medium text-gray-900">
          {what} {run.status === "running" ? "running" : run.status === "done" ? "finished" : "failed"}
        </span>
        <span className="text-gray-500">
          · {who}, {when}
        </span>
      </div>
      {run.status === "running" && (
        <p className="text-gray-500">This takes about a minute. You can close this window; it keeps going.</p>
      )}
      {run.status === "failed" && <p className="text-red-700">{run.error ?? "The import failed."}</p>}
      {run.report && (
        <>
          <table className="w-full">
            <tbody>
              {summaryRows(run.report).map((row) => (
                <tr key={row.label} className="border-t border-gray-100 first:border-t-0" title={row.hint}>
                  <td className="py-1 text-gray-600">{row.label}</td>
                  <td className="py-1 text-right font-medium tabular-nums text-gray-900">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!run.dryRun && run.report.images.failed.length > 0 && (
            <p className="text-amber-700">
              {run.report.images.failed.length} images couldn&apos;t be copied, usually because file storage isn&apos;t set
              up yet. They still load from Intercom for now. Once storage works, import again with &quot;Redo articles
              nobody has edited&quot; to copy them.
            </p>
          )}
          {run.report.links.dangling.length > 0 && (
            <p className="text-amber-700">
              {run.report.links.dangling.length} links point to Intercom articles that won&apos;t exist here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * "Import from Intercom": copies Intercom's help center in, on the support
 * service. Read-only on Intercom, and safe to repeat: articles already here
 * are left alone, so edits made here are never overwritten.
 */
export default function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: run, isLoading } = useHelpImport(open);
  const start = useStartHelpImport();
  const [skipDrafts, setSkipDrafts] = useState(false);
  const [replaceUnedited, setReplaceUnedited] = useState(false);
  const running = run?.status === "running";

  // When a real import finishes, the article list and collections are new.
  const lastStatus = useRef(run?.status);
  useEffect(() => {
    if (lastStatus.current === "running" && run?.status === "done" && !run.dryRun) {
      void queryClient.invalidateQueries({ queryKey: HELP_KEYS.all });
      toast.success("Intercom articles imported");
    }
    lastStatus.current = run?.status;
  }, [run?.status, run?.dryRun, queryClient]);

  const go = (dryRun: boolean) =>
    start.mutate(
      { dryRun, skipDrafts, replaceUnedited },
      {
        onError: (error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          toast.error(status === 409 ? "An import is already running" : "Could not start the import");
          void queryClient.invalidateQueries({ queryKey: HELP_KEYS.import });
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Intercom</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-gray-600">
            Copies Intercom&apos;s help center here: collections, articles, images and links. It only reads from
            Intercom. Articles already here are left alone, so edits made here are never overwritten. Preview first to see
            what would change.
          </p>
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={skipDrafts}
                disabled={running}
                onChange={(e) => setSkipDrafts(e.target.checked)}
              />
              Leave Intercom drafts behind
            </label>
            <label className="flex items-start gap-2 text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={replaceUnedited}
                disabled={running}
                onChange={(e) => setReplaceUnedited(e.target.checked)}
              />
              Redo articles nobody has edited since they were imported
            </label>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="size-4 animate-spin" /> Loading the last import…
            </div>
          ) : run ? (
            <RunSummary run={run} />
          ) : (
            <p className="text-gray-500">No import has run yet.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={running || start.isPending} onClick={() => go(true)}>
            Preview
          </Button>
          <Button disabled={running || start.isPending} onClick={() => go(false)}>
            {(running || start.isPending) && <Loader2 className="animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
