"use client";

import Link from "next/link";
import { ExternalLink, Headphones, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupportUserCases } from "@/hooks/use-support";
import { StatusBadge, intentLabel } from "@/components/support/support-format";
import { formatDateTime } from "@/lib/utils";

/**
 * This user's support cases (imported Intercom history included) and a link
 * into the inbox.
 */
export default function UserSupportCard({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useSupportUserCases(userId);
  const open = data?.cases.filter((c) => c.status !== "resolved").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-gray-400" />
          Support
        </CardTitle>
        {data && data.cases.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="muted">
              {data.cases.length} {data.cases.length === 1 ? "case" : "cases"}
            </Badge>
            {open > 0 && <Badge variant="warning">{open} open</Badge>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        ) : isError ? (
          <p className="text-sm text-gray-500">Support history could not be loaded.</p>
        ) : !data?.conversationId ? (
          <p className="text-sm text-gray-500">This user has never contacted support.</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {data.cases.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="text-gray-400">#{c.number}</span>
                  <span className="truncate text-gray-800">{c.title ?? intentLabel(c.intent)}</span>
                  <span className="ml-auto shrink-0 text-xs text-gray-500">{formatDateTime(c.createdAt)}</span>
                  <StatusBadge status={c.status} />
                  {c.csat && <span className="text-xs text-gray-500">{c.csat.score}/5</span>}
                </li>
              ))}
            </ul>
            <Link
              href={`/support?c=${data.conversationId}`}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
            >
              Open in inbox <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
