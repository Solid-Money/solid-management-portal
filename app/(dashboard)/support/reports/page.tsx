"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import AgentsOnly from "@/components/support/agents-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupportReport } from "@/hooks/use-support";
import { downloadComplaintRegister } from "@/lib/support-api";
import {
  duration,
  intentLabel,
  languageName,
  percent,
} from "@/components/support/support-format";
import type { SupportDurationStats } from "@/types/support";

const DAY = 24 * 60 * 60_000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function DurationRow({ label, stats }: { label: string; stats: SupportDurationStats }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 text-gray-700">{label}</td>
      <td className="py-2 text-right tabular-nums">{duration(stats.median)}</td>
      <td className="py-2 text-right tabular-nums">{duration(stats.p90)}</td>
      <td className="py-2 text-right tabular-nums text-gray-500">{stats.count}</td>
    </tr>
  );
}

function CountTable({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Nothing in this period.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-700">{row.label}</td>
                <td className="py-1.5 text-right tabular-nums">{row.count}</td>
                <td className="w-16 py-1.5 text-right tabular-nums text-gray-500">
                  {total ? `${Math.round((row.count / total) * 100)}%` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ReportsScreen() {
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 29 * DAY)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [downloading, setDownloading] = useState(false);
  // `to` is inclusive for people: the API takes the start of the next day.
  const range = useMemo(() => {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + DAY);
    return { from: start.toISOString(), to: end.toISOString(), valid: end > start };
  }, [from, to]);
  const { data, isLoading, isError } = useSupportReport(range.valid ? range.from : "", range.valid ? range.to : "");

  const download = async () => {
    setDownloading(true);
    try {
      await downloadComplaintRegister(range.from, range.to);
    } catch {
      toast.error("Could not download the complaint register");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Support reports</h1>
          <p className="text-sm text-gray-500">Cases opened in the period (UTC days). Up to 92 days at a time.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
          </div>
          <Button variant="outline" size="sm" onClick={() => void download()} disabled={downloading || !range.valid}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            Complaint register (CSV)
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-red-600">Could not load the report for this period.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Cases" value={String(data.cases)} />
            <Tile
              label="AI resolution"
              value={percent(data.ai.resolutionRate)}
              hint={`${data.ai.confirmed} confirmed · ${data.ai.assumed} assumed of ${data.ai.resolved} resolved`}
            />
            <Tile label="Handed to a human" value={percent(data.handoffRate)} />
            <Tile
              label="CSAT"
              value={data.csat.average !== null ? `${data.csat.average} / 5` : "—"}
              hint={`${data.csat.responses} ratings`}
            />
            <Tile label="First response (median)" value={duration(data.firstResponse.median)} hint="AI answer or acknowledgement" />
            <Tile label="Reopened within 7 days" value={percent(data.reopenRate)} />
            <Tile label="AI cost per case" value={data.cost.perCaseUsd !== null ? `$${data.cost.perCaseUsd.toFixed(3)}` : "—"} hint={`$${data.cost.totalUsd.toFixed(2)} over ${data.cost.aiRuns} AI turns`} />
            <Tile label="Waiting over a day, no reply" value={String(data.withoutReply.count)} hint="Open now, any period" />
          </div>

          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Cases per day</h2>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="#f1f1f4" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "#eef2ff" }}
                    formatter={(value: number) => [value, "Cases"]}
                    labelFormatter={(value: string) => new Date(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  />
                  <Bar dataKey="total" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Response times</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="py-1 text-left font-medium" />
                    <th className="py-1 text-right font-medium">Median</th>
                    <th className="py-1 text-right font-medium">90th pct</th>
                    <th className="py-1 text-right font-medium">Cases</th>
                  </tr>
                </thead>
                <tbody>
                  <DurationRow label="First response" stats={data.firstResponse} />
                  <DurationRow label="First human reply after handoff" stats={data.firstHumanReplyAfterHandoff} />
                  <DurationRow label="Time to resolve" stats={data.timeToResolve} />
                </tbody>
              </table>
              <h3 className="mt-4 text-xs font-semibold text-gray-700">Ratings</h3>
              <div className="mt-1 flex gap-2 text-xs text-gray-600">
                {(["1", "2", "3", "4", "5"] as const).map((score) => (
                  <span key={score} className="rounded bg-gray-100 px-2 py-0.5">
                    {score}★ {data.csat.distribution[score]}
                  </span>
                ))}
              </div>
            </section>
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Content gaps</h2>
              <p className="text-xs text-gray-500">Handoffs where the help center had no answer, by intent: articles to write.</p>
              {data.contentGaps.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">None in this period.</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {data.contentGaps.map((gap) => (
                      <tr key={gap.intent} className="border-t border-gray-100">
                        <td className="py-1.5 text-gray-700">{intentLabel(gap.intent)}</td>
                        <td className="py-1.5 text-right tabular-nums">{gap.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data.withoutReply.cases.length > 0 && (
                <>
                  <h3 className="mt-4 text-xs font-semibold text-gray-700">Longest waiting without a reply</h3>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {data.withoutReply.cases.slice(0, 8).map((item) => (
                      <li key={item.caseId}>
                        <Link href={`/support?c=${item.conversationId}`} className="text-indigo-600 hover:underline">
                          Case #{item.number} · {item.conversationId.slice(-8)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <CountTable title="By intent" rows={data.byIntent.map((row) => ({ label: intentLabel(row.intent === "unlabelled" ? null : row.intent), count: row.count }))} />
            <CountTable title="By language" rows={data.byLanguage.map((row) => ({ label: row.language === "unknown" ? "Not detected" : (languageName(row.language) ?? row.language), count: row.count }))} />
          </div>
        </>
      )}
    </div>
  );
}

export default function SupportReportsPage() {
  return <AgentsOnly>{() => <ReportsScreen />}</AgentsOnly>;
}
