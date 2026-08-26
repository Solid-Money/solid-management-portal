"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Headphones, Loader2 } from "lucide-react";

import { getUserIntercomHistory } from "@/lib/api";
import { IntercomUserHistory } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatUnix(seconds?: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Whether this user has contacted support, how often, and what is still open.
 *
 * Intercom is optional: without INTERCOM_API_KEY the backend answers
 * `configured: false` and this renders a quiet note rather than an error, so
 * environments without a token still get a working user page.
 */
export default function UserIntercomCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: IntercomUserHistory }>({
    queryKey: ["user-intercom", userId],
    queryFn: async () => (await getUserIntercomHistory(userId)).data,
    // Intercom is rate-limited and this is background context, not live state.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const history = data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-gray-400" />
          Support history (Intercom)
        </CardTitle>
        {history?.configured && history.contact && (
          <div className="flex items-center gap-2">
            <Badge variant={history.openConversations > 0 ? "warning" : "muted"}>
              {history.totalConversations}{" "}
              {history.totalConversations === 1 ? "ticket" : "tickets"}
            </Badge>
            {history.openConversations > 0 && (
              <Badge variant="danger">{history.openConversations} open</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">
            Failed to load Intercom history.
          </p>
        ) : !history?.configured ? (
          <p className="text-sm text-gray-500">
            Intercom is not configured for this environment. Set{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
              INTERCOM_API_KEY
            </code>{" "}
            on the admins service to turn this panel on.
          </p>
        ) : history.error ? (
          <p className="text-sm text-amber-700">{history.error}</p>
        ) : !history.contact ? (
          <p className="text-sm text-gray-500">
            This user has never contacted support — no Intercom contact exists
            for their email address.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>
                Last contact:{" "}
                <span className="text-gray-900">
                  {formatUnix(history.lastContactAt)}
                </span>
              </span>
              <span>
                Last seen:{" "}
                <span className="text-gray-900">
                  {formatUnix(history.contact.last_seen_at)}
                </span>
              </span>
              {history.contact.url && (
                <a
                  href={history.contact.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  Open in Intercom
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {history.conversations.length === 0 ? (
              <p className="text-sm text-gray-500">
                A contact exists, but they have never opened a conversation.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                {history.conversations.map((conversation) => (
                  <li
                    key={conversation.id}
                    className="flex items-start justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-900">
                        {conversation.title || "(no subject)"}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {formatUnix(
                          conversation.updatedAt ?? conversation.createdAt
                        )}
                        {conversation.initiatedBy &&
                          ` · started by ${conversation.initiatedBy}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={conversation.open ? "warning" : "muted"}
                      >
                        {conversation.state ??
                          (conversation.open ? "open" : "closed")}
                      </Badge>
                      {conversation.url && (
                        <a
                          href={conversation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800"
                          title="Open conversation in Intercom"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
