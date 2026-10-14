"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import UserKycCard from "@/components/user/user-kyc-card";
import UserTierMembershipCard from "@/components/user/user-tier-membership-card";
import UserCashbackCard from "@/components/user/user-cashback-card";
import UserRecoveryCard from "@/components/user/user-recovery-card";
import { useSupportConversation } from "@/hooks/use-support";
import {
  StatusBadge,
  dateTime,
  intentLabel,
  languageName,
} from "@/components/support/support-format";

/**
 * Who the customer is, beside the thread. The account blocks are the user
 * page's own cards, so every action an agent needs (KYC reset, recovery,
 * cashback) is where it already lives; nothing is rebuilt here.
 */
export default function ContextPanel({ conversationId }: { conversationId: string }) {
  const { data } = useSupportConversation(conversationId);
  if (!data) return <aside className="rounded-lg bg-white shadow-sm" />;
  const { conversation, cases } = data;
  const userId = conversation.userId;
  const username = conversation.userLabel ?? "";

  return (
    <aside className="scrollbar-subtle h-full min-h-0 space-y-3 overflow-y-auto pr-1">
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Customer</h3>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Username</dt>
            <dd className="text-gray-900">{conversation.userLabel ?? "—"}</dd>
          </div>
          {userId && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500">User id</dt>
              <dd className="flex items-center gap-1 font-mono text-gray-900">
                {userId.slice(0, 8)}…
                <CopyButton value={userId} />
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Language</dt>
            <dd className="text-gray-900">{languageName(conversation.language) ?? "Not detected yet"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">First contact</dt>
            <dd className="text-gray-900">{dateTime(conversation.createdAt)}</dd>
          </div>
        </dl>
        {userId ? (
          <Link
            href={`/users/${userId}`}
            className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            Open user page <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <p className="mt-2 text-xs text-gray-500">Unverified guest: not linked to an account.</p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Support history</h3>
        <ul className="mt-2 space-y-1.5">
          {cases.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">#{c.number}</span>
              <span className="truncate text-gray-800">{c.title ?? intentLabel(c.intent)}</span>
              <span className="ml-auto shrink-0">
                <StatusBadge status={c.status} />
              </span>
              {c.csat && <span className="shrink-0 text-gray-500">{c.csat.score}/5</span>}
            </li>
          ))}
        </ul>
      </section>

      {userId && (
        <div className="space-y-3 [&_[data-slot=card-header]]:flex-wrap [&_[data-slot=card-header]]:gap-2 [&_[data-slot=card]]:shadow-sm">
          <UserKycCard userId={userId} username={username} />
          <UserTierMembershipCard userId={userId} />
          <UserCashbackCard userId={userId} />
          <UserRecoveryCard userId={userId} username={username} />
        </div>
      )}
    </aside>
  );
}
