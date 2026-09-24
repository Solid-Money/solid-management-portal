"use client";

import { useState } from "react";
import { formatRate } from "@/lib/fee-rate";
import { useDepositFeeHistory } from "@/hooks/use-deposit-fees";
import {
  CHAIN_NAMES,
  DepositFeeMatrix,
  DepositFeeRoute,
} from "@/types/deposit-fees";

const PAGE = 50;
const MAX = 200;

export default function HistoryTable({ matrix }: { matrix: DepositFeeMatrix }) {
  const [route, setRoute] = useState<DepositFeeRoute | "">("");
  const [chainId, setChainId] = useState<number | "">("");
  const [limit, setLimit] = useState(PAGE);
  const { data, isLoading } = useDepositFeeHistory({
    route: route || undefined,
    chainId: chainId === "" ? undefined : chainId,
    limit,
  });

  const labelFor = (r: DepositFeeRoute) =>
    matrix.routes.find((row) => row.route === r)?.label ?? r;

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={route}
          onChange={(e) => {
            setRoute(e.target.value as DepositFeeRoute | "");
            setLimit(PAGE);
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All routes</option>
          {matrix.routes.map((row) => (
            <option key={row.route} value={row.route}>
              {row.label}
            </option>
          ))}
        </select>
        <select
          value={chainId}
          onChange={(e) => {
            setChainId(e.target.value === "" ? "" : Number(e.target.value));
            setLimit(PAGE);
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All chains</option>
          {matrix.chains.map((id) => (
            <option key={id} value={id}>
              {CHAIN_NAMES[id] ?? id}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No changes yet. Every cell is on the{" "}
          {formatRate(matrix.defaultRatePpm)} default.
        </p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 font-medium">When</th>
              <th className="py-2 font-medium">Admin</th>
              <th className="py-2 font-medium">Route</th>
              <th className="py-2 font-medium">Chain</th>
              <th className="py-2 font-medium">Change</th>
              <th className="py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row._id} className="border-b border-gray-100">
                <td className="py-2 whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="py-2">{row.adminEmail}</td>
                <td className="py-2">{labelFor(row.route)}</td>
                <td className="py-2">
                  {CHAIN_NAMES[row.chainId] ?? row.chainId}
                </td>
                <td className="py-2 whitespace-nowrap">
                  {formatRate(row.previousRatePpm, matrix.defaultRatePpm)} →{" "}
                  {formatRate(row.newRatePpm, matrix.defaultRatePpm)}
                </td>
                <td className="py-2 text-gray-600">{row.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && data.length === limit && limit < MAX ? (
        <button
          onClick={() => setLimit((l) => Math.min(l + PAGE, MAX))}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
