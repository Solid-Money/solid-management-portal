"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import {
  useRecheckRun,
  useRecheckRuns,
  useStartRecheck,
} from "@/hooks/use-referral-review";
import { reversalReasonLabel, reviewReasonLabel } from "@/lib/referral";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { ReferralRecheckRun } from "@/types/referral-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** A count as the page shows it: "1,840". */
const count = (value: number) => formatNumber(value, 0, 0);

/** The daily payout sweep runs at 02:00 UTC. */
function nextPayoutSweep(now: number): Date {
  const at = new Date(now);
  const next = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), 2),
  );
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function untilLabel(target: Date, now: number): string {
  const minutes = Math.max(0, Math.round((target.getTime() - now) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/**
 * Put every qualified, unpaid reward through the rules as they stand today —
 * the excluded merchants, the minimum purchase, self-referral, referrer blocks
 * and the monthly threshold — as a trial run first, then for real before the
 * 02:00 UTC payout.
 */
export function RecheckPanel() {
  const runs = useRecheckRuns();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const start = useStartRecheck();

  // The countdown to the sweep keeps moving while the page sits open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const latestId = runs.data?.[0]?.id ?? null;
  const viewing = useRecheckRun(selectedId ?? latestId);
  const lastTrial = runs.data?.find(
    (run) => run.dryRun && run.status === "done",
  );
  // From the list, which polls while a run is going — not from the run on
  // screen, which can be an older one.
  const running = runs.data?.some((run) => run.status === "running") ?? false;
  const sweep = nextPayoutSweep(now);

  const startRun = (dryRun: boolean, reason?: string) =>
    start.mutate(
      { dryRun, ...(reason && { reason }) },
      {
        onSuccess: (run) => {
          setSelectedId(run.id);
          setConfirmLive(false);
          toast.success(
            dryRun
              ? "Trial run started — nothing will be changed"
              : "Re-check started",
          );
        },
      },
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="max-w-3xl space-y-1 text-sm text-gray-600">
          <p>
            Checks every <strong>qualified, unpaid</strong> reward against
            today&apos;s rules. The trial run changes nothing and lists what
            would be held or voided. The real run then holds and voids them,
            and files each one on the friend&apos;s audit trail.
          </p>
          <p className="text-xs text-gray-500">
            Next payout sweep: {formatDateTime(sweep.toISOString())} (in{" "}
            {untilLabel(sweep, now)}). Rewards still qualified then are paid if their
            payout delay is over.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => startRun(true)}
            disabled={start.isPending || running}
            className="cursor-pointer"
          >
            <FlaskConical className="h-4 w-4" />
            Trial run
          </Button>
          <Button
            onClick={() => setConfirmLive(true)}
            disabled={start.isPending || running}
            className="cursor-pointer"
          >
            <PlayCircle className="h-4 w-4" />
            Run for real…
          </Button>
        </div>
      </div>

      {runs.isError || viewing.isError ? (
        // A failed read is not an empty history: say so, and offer a retry.
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>Could not load the re-check runs.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void runs.refetch();
              if (viewing.isError) void viewing.refetch();
            }}
            className="cursor-pointer"
          >
            Retry
          </Button>
        </div>
      ) : viewing.data ? (
        <RunView run={viewing.data} />
      ) : runs.isLoading || viewing.isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No re-check has been run yet. Start with a trial run.
        </p>
      )}

      {runs.data && runs.data.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <h3 className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase text-gray-500">
            Recent runs
          </h3>
          <ul className="divide-y divide-gray-100 text-xs">
            {runs.data.map((run) => (
              <li key={run.id}>
                <button
                  onClick={() => setSelectedId(run.id)}
                  className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 ${
                    (selectedId ?? latestId) === run.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <Badge variant={run.dryRun ? "muted" : "info"}>
                    {run.dryRun ? "Trial" : "Real"}
                  </Badge>
                  <span className="text-gray-700">
                    {formatDateTime(run.startedAt)} by {run.startedBy}
                  </span>
                  <span className="text-gray-500">
                    {count(run.counts.hold)} hold · {count(run.counts.void)}{" "}
                    void · {count(run.counts.stays)} stay
                  </span>
                  <RunStatus run={run} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mounted only while open, so each run starts with an empty reason
          and never files the last run's on the audit trail. */}
      {confirmLive && (
        <LiveRunDialog
          open
          lastTrial={lastTrial}
          pending={start.isPending}
          onCancel={() => setConfirmLive(false)}
          onConfirm={(reason) => startRun(false, reason)}
        />
      )}
    </div>
  );
}

function RunStatus({ run }: { run: ReferralRecheckRun }) {
  if (run.status === "running") {
    return <Badge variant="warning">Running</Badge>;
  }
  if (run.status === "failed") return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="success">Done</Badge>;
}

function RunView({ run }: { run: ReferralRecheckRun }) {
  const progress = run.total > 0 ? (run.processed / run.total) * 100 : 100;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={run.dryRun ? "muted" : "info"}>
          {run.dryRun ? "Trial run — nothing changed" : "Real run"}
        </Badge>
        <RunStatus run={run} />
        <span className="text-gray-600">
          {formatDateTime(run.startedAt)} by {run.startedBy}
          {run.reason ? ` — "${run.reason}"` : ""}
        </span>
      </div>

      {run.status === "running" && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {count(run.processed)} of {count(run.total)} rewards checked
          </p>
        </div>
      )}
      {run.error && (
        <p className="rounded-md bg-red-50 p-2 text-xs text-red-800">
          {run.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Checked" value={run.total} />
        <Stat label="Stay qualified" value={run.counts.stays} />
        <Stat
          label={run.dryRun ? "Would hold" : "Held"}
          value={run.counts.hold}
          tone="amber"
        />
        <Stat
          label={run.dryRun ? "Would void" : "Voided"}
          value={run.counts.void}
          tone="red"
        />
        <Stat label="Skipped" value={run.counts.skipped} />
      </div>

      {run.status !== "running" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <UserList
            title={run.dryRun ? "Would be voided" : "Voided"}
            rows={run.void.map((row) => ({
              ...row,
              detail: reversalReasonLabel(row.reason),
            }))}
          />
          <UserList
            title={run.dryRun ? "Would be held for review" : "Held for review"}
            rows={run.hold.map((row) => ({
              ...row,
              detail: row.reasons.map(reviewReasonLabel).join(", "),
            }))}
          />
          <UserList
            title="Need one more eligible purchase before payout"
            description="They stay qualified, but the payout cancels the reward unless they buy again — worth a nudge."
            rows={run.needsPurchase.map((row) => ({ ...row, detail: "" }))}
          />
          <UserList
            title="Skipped"
            description="Payout already in flight, or the friend's spend could not be read — checked again at payout."
            rows={run.skipped.map((row) => ({ ...row, detail: row.error }))}
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "red";
}) {
  const color =
    tone === "amber" && value > 0
      ? "text-amber-700"
      : tone === "red" && value > 0
        ? "text-red-700"
        : "text-gray-900";
  return (
    <div className="rounded-md border border-gray-100 p-3">
      <p className="text-[11px] uppercase text-gray-500">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{count(value)}</p>
    </div>
  );
}

function UserList({
  title,
  description,
  rows,
}: {
  title: string;
  description?: string;
  rows: { referredUserId: string; username?: string; detail: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border border-gray-100">
      <div className="border-b border-gray-100 px-3 py-2">
        <h4 className="text-xs font-semibold text-gray-900">
          {title} ({count(rows.length)})
        </h4>
        {description && (
          <p className="text-[11px] text-gray-500">{description}</p>
        )}
      </div>
      <ul className="max-h-64 divide-y divide-gray-50 overflow-auto text-xs">
        {rows.map((row) => (
          <li key={row.referredUserId} className="px-3 py-1.5">
            <Link
              href={`/users/${row.referredUserId}`}
              className="font-medium text-indigo-600 hover:underline"
            >
              {row.username || row.referredUserId}
            </Link>
            {row.detail && (
              <span className="ml-2 text-gray-500">{row.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveRunDialog({
  open,
  lastTrial,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  lastTrial?: ReferralRecheckRun;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !pending ? onCancel() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-check every unpaid reward for real</DialogTitle>
          <DialogDescription>
            Rewards the rules no longer pay are voided, and those that need a
            decision are held for review. It reads the rules as they stand
            when it runs, so the result can differ from the last trial.
          </DialogDescription>
        </DialogHeader>
        {lastTrial ? (
          <p className="rounded-md bg-gray-50 p-3 text-xs text-gray-700">
            Last trial ({formatDateTime(lastTrial.startedAt)}):{" "}
            <strong>{count(lastTrial.counts.void)}</strong> would be voided,{" "}
            <strong>{count(lastTrial.counts.hold)}</strong> held,{" "}
            {count(lastTrial.counts.stays)} stay qualified.
          </p>
        ) : (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            No trial run has finished yet — run one first to see what this
            will do.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="recheck-reason">Reason</Label>
          <Textarea
            id="recheck-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. Applying the new merchant exclusions before tonight's payout"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim() || pending}
            className="cursor-pointer"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Hold and void
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
