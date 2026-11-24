"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw } from "lucide-react";

import { NudgeReviewDialog } from "@/components/nudges/nudge-review-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRestoreNudgeVersion } from "@/hooks/use-nudges";
import { formatChangeValue } from "@/lib/nudges";
import type {
  NudgeCatalogView,
  NudgeChangeSource,
  NudgeVersionView,
  NudgeView,
} from "@/types/nudges";

export const SOURCE_LABEL: Record<NudgeChangeSource, string> = {
  portal: "admin",
  claude: "Claude",
  migration: "migration",
};

/**
 * A nudge's versions, newest first, each with what changed and why. Any older
 * version can be put back; that is saved as a new version, so nothing is lost.
 */
export function NudgeVersions({
  nudge,
  versions,
  catalog,
  canRestore,
}: {
  nudge: NudgeView;
  versions: NudgeVersionView[];
  catalog: NudgeCatalogView;
  canRestore: boolean;
}) {
  const [restoring, setRestoring] = useState<NudgeVersionView | null>(null);
  const restore = useRestoreNudgeVersion();

  if (versions.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No versions yet: this nudge has not been moved to the database.
      </p>
    );
  }

  return (
    <>
      <ol className="space-y-3">
        {versions.map((version) => (
          <li
            key={version.version}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium text-gray-900">v{version.version}</span>
                <Badge variant={version.source === "claude" ? "info" : "muted"}>
                  {SOURCE_LABEL[version.source]}
                </Badge>
                <span className="text-xs text-gray-500">
                  {version.by} ·{" "}
                  {formatDistanceToNow(new Date(version.at), { addSuffix: true })}
                </span>
              </span>
              {canRestore && version.version !== nudge.version ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setRestoring(version)}
                >
                  <RotateCcw />
                  Restore
                </Button>
              ) : null}
            </div>
            {version.reason ? (
              <p className="mt-1 text-gray-600">{version.reason}</p>
            ) : null}
            {version.changes.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                {version.changes.map((change) => (
                  <li key={change.field} className="break-words">
                    <span className="font-mono">{change.field}</span>:{" "}
                    {formatChangeValue(change.from)} →{" "}
                    <span className="text-gray-800">
                      {formatChangeValue(change.to)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      <NudgeReviewDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={`Restore ${nudge.name} to v${restoring?.version ?? ""}`}
        description="The nudge goes back to how it was at that version, saved as a new version. It takes effect within a minute."
        changes={[
          {
            field: "version",
            from: `v${nudge.version}`,
            to: `as v${restoring?.version ?? ""}`,
          },
        ]}
        reasonMin={catalog.limits.reasonMin}
        reasonMax={catalog.limits.reasonMax}
        saving={restore.isPending}
        confirmLabel="Restore"
        onConfirm={(reason) => {
          if (!restoring) return;
          restore.mutate(
            {
              key: nudge.key,
              version: restoring.version,
              input: { expectedVersion: nudge.version, reason },
            },
            { onSuccess: () => setRestoring(null) }
          );
        }}
      />
    </>
  );
}
