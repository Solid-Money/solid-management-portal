"use client";

import { useQuery } from "@tanstack/react-query";

import { getUserUncollectedSettlements } from "@/lib/api";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { UncollectedSettlements } from "@/types/cash-collect";
import { Badge } from "@/components/ui/badge";
import { CopyableValue } from "@/components/ui/copy-button";
import CollectSettlementDialog from "@/components/user/collect-settlement-dialog";

const CAUSE_LABELS: Record<string, string> = {
  ARREARS: "Sweep failed",
  REFUSED_MANDATORY: "Refused mandatory",
};

/**
 * Card spends Wirex paid for that we never swept from this user's Safe.
 *
 * Renders nothing when there are none, which is almost always: this only
 * appears for a cardholder who owes us money nothing automatic will collect.
 * Each row can be collected through the normal sweep.
 */
export default function CardUncollectedSection({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const { data, isError } = useQuery<UncollectedSettlements>({
    queryKey: ["user-card-uncollected", userId],
    queryFn: async () => (await getUserUncollectedSettlements(userId)).data,
  });

  if (isError) {
    return (
      <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        Could not check for uncollected card spends. Reload before concluding
        this user owes nothing.
      </p>
    );
  }

  if (!data || data.settlements.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-red-800">
          Uncollected card spends
        </h4>
        <Badge variant="danger">{formatUsd(data.totalUsd)} owed</Badge>
      </div>

      <p className="text-xs text-red-800">
        Wirex paid for these and we never collected them from the Safe.{" "}
        {typeof data.spendableUsd === "number"
          ? `The Safe can cover ${formatUsd(data.spendableUsd)} right now.`
          : "The Safe's balance could not be read."}
        {data.moduleEnabled === false &&
          " Module consent is revoked, so nothing can be swept until they re-enable it."}
      </p>

      <ul className="space-y-2">
        {data.settlements.map((settlement) => (
          <li
            key={settlement.uniqueOperationId}
            className="space-y-1.5 rounded-md border border-red-200 bg-white p-2.5 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-gray-900">
                    {formatUsd(settlement.amountUsd)}
                  </span>
                  <Badge variant="danger">
                    {CAUSE_LABELS[settlement.cause] ?? settlement.cause}
                  </Badge>
                  {settlement.refundsPaidUsd > 0 && (
                    <Badge variant="warning">
                      {formatUsd(settlement.refundsPaidUsd)} refund paid
                    </Badge>
                  )}
                  {settlement.createdAt && (
                    <span className="text-gray-500">
                      {formatDateTime(settlement.createdAt)}
                    </span>
                  )}
                </div>
                <CopyableValue
                  value={settlement.uniqueOperationId}
                  label="Operation ID"
                  truncate
                />
              </div>
              <CollectSettlementDialog
                userId={userId}
                username={username}
                settlement={settlement}
                spendableUsd={data.spendableUsd}
              />
            </div>
            <p className="text-gray-600">{settlement.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
