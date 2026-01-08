"use client";

import { AdminActivity } from "@/types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const isEmpty = (value?: string | null): boolean => {
  return value === null || value === undefined;
};

const isZero = (value?: string | null): boolean => {
  if (isEmpty(value)) return false;
  return parseFloat(value!) === 0;
};

const formatUSD = (fee?: string | null, feeUSD?: string | null): string => {
  if (isEmpty(fee) && isEmpty(feeUSD)) {
    return "";
  }
  
  const feeUSDNum = feeUSD ? parseFloat(feeUSD) : 0;
  const feeNum = fee ? parseFloat(fee) : 0;
  
  if (isZero(feeUSD) && feeNum > 0) {
    return "<$0.01";
  }
  
  if (feeUSDNum > 0 && feeUSD) {
    return `$${feeUSD}`;
  }
  
  return "";
};

const transactionTypes = [
  { key: "permitTx", label: "Permit" },
  { key: "transferTx", label: "Transfer" },
  { key: "approvalTx", label: "Approval" },
  { key: "bridgeTx", label: "Bridge" },
  { key: "bridgeTxSendingAsset", label: "Bridge Sending Asset" },
  { key: "depositTx", label: "Deposit" },
] as const;

type TransactionTypeKey = typeof transactionTypes[number]["key"];
type FeeKeys = `${TransactionTypeKey}Fee` | `${TransactionTypeKey}FeeUSD`;

const getFee = (activity: AdminActivity, key: FeeKeys) =>
  activity[key as keyof AdminActivity] as string | undefined;

interface SponsoredGasFeeProps {
  activity: AdminActivity;
}

export default function SponsoredGasFee({ activity }: SponsoredGasFeeProps) {
  const formattedTotalFeeUSD = formatUSD(activity.totalFee, activity.totalFeeUSD);
  if (!formattedTotalFeeUSD) return <span>-</span>;
  
  const hasBreakdown = transactionTypes.some((type) => {
    const feeUSD = getFee(activity, `${type.key}FeeUSD`);
    return feeUSD && parseFloat(feeUSD) > 0;
  });
  
  if (!hasBreakdown) {
    return <span>{formattedTotalFeeUSD}</span>;
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-2">
          {formattedTotalFeeUSD}
        </span>
      </TooltipTrigger>
      <TooltipContent className="bg-gray-900 text-white p-3 space-y-1">
        <div className="font-semibold mb-2">Fee Breakdown:</div>
        {transactionTypes.map((type) => {
          const fee = getFee(activity, `${type.key}Fee`);
          const feeUSD = getFee(activity, `${type.key}FeeUSD`);
          const formattedFee = formatUSD(fee, feeUSD);
          return formattedFee ? (
            <div key={type.key} className="text-xs">
              {type.label}: {formattedFee}
            </div>
          ) : null;
        })}
      </TooltipContent>
    </Tooltip>
  );
}
