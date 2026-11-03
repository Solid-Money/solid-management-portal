"use client";

import Link from "next/link";
import { walletOf } from "@/lib/attention";
import { dayLabel } from "@/lib/overview-range";
import type { AttentionItemView } from "@/types/radar";

/**
 * The accounts behind an item, each a link to its user page, and the outside
 * wallet when the item is a cash-out pattern: where "is this one person?" is
 * answered.
 */
export function AttentionAccounts({ item }: { item: AttentionItemView }) {
  const wallet = walletOf(item);
  const accounts = item.accounts ?? [];
  if (!wallet && accounts.length === 0) return null;
  const shown =
    item.affectedCount > accounts.length
      ? `${accounts.length} of ${item.affectedCount}`
      : `${accounts.length}`;
  const year = new Date().toISOString().slice(0, 4);

  return (
    <div className="mt-4">
      <p className="border-b border-[#eef0f4] pb-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        Accounts{accounts.length > 0 ? ` · ${shown}` : ""}
      </p>
      {wallet ? (
        <p className="mt-2 text-[12.5px] text-gray-600">
          Sent to{" "}
          <code className="font-mono text-[11.5px] break-all text-gray-800 select-all">
            {wallet}
          </code>
        </p>
      ) : null}
      {accounts.length > 0 ? (
        <ul className="mt-1 divide-y divide-[#f1f2f6]">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]"
            >
              <Link
                href={`/users/${account.id}`}
                className="truncate font-medium text-[#3b3bd6] hover:underline"
              >
                {account.username ?? account.id}
              </Link>
              <span className="shrink-0 text-gray-500">
                {[
                  account.country,
                  account.signedUpAt
                    ? `joined ${dayLabel(account.signedUpAt.slice(0, 10), year)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
