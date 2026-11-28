"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

import { SOURCE_LABEL } from "@/components/nudges/nudge-versions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNudgeHistory } from "@/hooks/use-nudges";
import { formatChangeValue } from "@/lib/nudges";
import type { NudgeFieldChange } from "@/types/nudges";

/** How many of an entry's changes show before "Show N more". */
const PREVIEW = 6;

/** Every change to every nudge and to the rules, newest first. */
export function NudgeHistory({ onOpen }: { onOpen: (key: string) => void }) {
  const { data, isLoading, error, refetch, isRefetching } = useNudgeHistory();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  // The full error only when nothing was ever loaded: a failed background
  // refresh keeps the rows already on screen.
  if (!data) {
    return (
      <p className="text-sm text-red-600">
        Failed to load the history.{" "}
        <button
          type="button"
          onClick={() => void refetch()}
          className="cursor-pointer underline"
        >
          Try again
        </button>
      </p>
    );
  }

  // Shown over cached rows, an empty list included: either may be stale.
  const refreshFailed = error ? (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Couldn&apos;t refresh the history; showing what was loaded before.{" "}
      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isRefetching}
        className="cursor-pointer underline disabled:cursor-default disabled:opacity-60"
      >
        {isRefetching ? "Refreshing…" : "Try again"}
      </button>
    </p>
  ) : null;

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        {refreshFailed}
        <p className="text-sm text-gray-500">No changes yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {refreshFailed}
      <div className="rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">When</TableHead>
              <TableHead className="w-48">Who</TableHead>
              <TableHead className="w-52">Nudge</TableHead>
              <TableHead>Reason and changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={`${entry.key}:${entry.version}`} className="align-top">
                <TableCell className="text-xs text-gray-600">
                  <span title={new Date(entry.at).toLocaleString()}>
                    {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  <span className="block truncate text-gray-800">{entry.by}</span>
                  <Badge variant={entry.source === "claude" ? "info" : "muted"}>
                    {SOURCE_LABEL[entry.source]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {entry.key === "settings" ? (
                    <span className="text-gray-800">Rules</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpen(entry.key)}
                      className="cursor-pointer font-mono text-indigo-600 hover:underline"
                    >
                      {entry.key}
                    </button>
                  )}
                  <span className="ml-1 text-gray-400">v{entry.version}</span>
                </TableCell>
                <TableCell className="text-xs whitespace-normal">
                  {entry.reason ? (
                    <p className="text-gray-800">{entry.reason}</p>
                  ) : null}
                  <ChangeList changes={entry.changes} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** An entry's changes: the first few, and a toggle for the rest. */
function ChangeList({ changes }: { changes: NudgeFieldChange[] }) {
  const [all, setAll] = useState(false);
  if (changes.length === 0) return null;
  const hidden = changes.length - PREVIEW;
  const shown = all ? changes : changes.slice(0, PREVIEW);
  return (
    <ul className="mt-1 space-y-0.5 text-gray-500">
      {shown.map((change) => (
        <li key={change.field} className="break-words">
          <span className="font-mono">{change.field}</span>:{" "}
          {formatChangeValue(change.from)} →{" "}
          <span className="text-gray-800">{formatChangeValue(change.to)}</span>
        </li>
      ))}
      {hidden > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="cursor-pointer text-indigo-600 hover:underline"
          >
            {all ? "Show fewer" : `Show ${hidden} more`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
