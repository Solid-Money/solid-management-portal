"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDay } from "@/lib/ai-api";
import { formatUsd } from "@/lib/utils";

/** What users were billed per UTC day, with requests and users on hover. */
export default function AiApiUsageChart({
  data,
  height = 260,
}: {
  data: { day: string; billedUsd: number; requests?: number; users?: number }[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-500"
        style={{ height }}
      >
        No usage in this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="day"
          tickFormatter={formatDay}
          tick={{ fontSize: 12, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => formatUsd(value, 0)}
          tick={{ fontSize: 12, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ fill: "#EEF2FF" }}
          content={({ active, payload }) => {
            const row = active ? payload?.[0]?.payload : null;
            if (!row) return null;
            return (
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                <div className="font-medium text-gray-900">
                  {formatDay(row.day)}
                </div>
                <div className="text-gray-700">
                  Billed {formatUsd(row.billedUsd)}
                </div>
                {row.requests !== undefined ? (
                  <div className="text-gray-500">
                    {row.requests.toLocaleString()} requests
                    {row.users !== undefined
                      ? ` · ${row.users.toLocaleString()} users`
                      : ""}
                  </div>
                ) : null}
              </div>
            );
          }}
        />
        <Bar dataKey="billedUsd" fill="#4F46E5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
