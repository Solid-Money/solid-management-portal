"use client";

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

/** Every change to every nudge and to the rules, newest first. */
export function NudgeHistory({ onOpen }: { onOpen: (key: string) => void }) {
  const { data, isLoading, error } = useNudgeHistory();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-red-600">Failed to load the history.</p>;
  }
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">No changes yet.</p>;
  }

  return (
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
                {entry.changes.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-gray-500">
                    {entry.changes.slice(0, 6).map((change) => (
                      <li key={change.field} className="break-words">
                        <span className="font-mono">{change.field}</span>:{" "}
                        {formatChangeValue(change.from)} →{" "}
                        <span className="text-gray-800">
                          {formatChangeValue(change.to)}
                        </span>
                      </li>
                    ))}
                    {entry.changes.length > 6 ? (
                      <li>and {entry.changes.length - 6} more</li>
                    ) : null}
                  </ul>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
