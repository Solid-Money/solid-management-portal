"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { DepositSummary } from "@/types";
import { ArrowDownToLine, CreditCard, Loader2 } from "lucide-react";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CategorySection({
  icon,
  label,
  total,
  count,
  byTitle,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  count: number;
  byTitle: { title: string; total: number; count: number }[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-900">{label}</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">
            ${formatAmount(total)}
          </p>
          <p className="text-[10px] text-gray-500">
            {count} {count === 1 ? "deposit" : "deposits"}
          </p>
        </div>
      </div>
      {byTitle.length > 0 && (
        <div className="ml-8 space-y-1">
          {byTitle.map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0"
            >
              <span className="text-gray-600 truncate mr-2">{item.title}</span>
              <span className="text-gray-900 font-medium whitespace-nowrap">
                ${formatAmount(item.total)}{" "}
                <span className="text-gray-400">({item.count})</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DepositSummaryCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery<{ data: DepositSummary }>({
    queryKey: ["user-deposit-summary", userId],
    queryFn: async () => {
      const res = await api.get(`/admin/v1/users/${userId}/deposit-summary`);
      return res.data;
    },
  });

  const summary = data?.data;

  return (
    <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-xl">
      <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-base leading-6 font-semibold text-gray-900">
          Deposit Summary
        </h3>
      </div>
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin h-5 w-5 text-indigo-600" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">Failed to load deposit summary</p>
        ) : summary ? (
          <div className="space-y-4">
            <CategorySection
              icon={
                <div className="p-1.5 rounded-full bg-emerald-50">
                  <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                </div>
              }
              label="Solid Deposits"
              total={summary.solidDeposits.total}
              count={summary.solidDeposits.count}
              byTitle={summary.solidDeposits.byTitle}
            />
            <div className="border-t border-gray-100" />
            <CategorySection
              icon={
                <div className="p-1.5 rounded-full bg-blue-50">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
              }
              label="Bridge Card Deposits"
              total={summary.bridgeCardDeposits.total}
              count={summary.bridgeCardDeposits.count}
              byTitle={summary.bridgeCardDeposits.byTitle}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No deposit data available</p>
        )}
      </div>
    </div>
  );
}
