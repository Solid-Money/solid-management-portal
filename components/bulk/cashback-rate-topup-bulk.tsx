"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import {
  auditCashbackRate,
  getCashbackRateAuditJob,
  resumeCashbackRateAudit,
} from "@/lib/api";
import {
  buildRateAuditQuery,
  describeRateAuditWindow,
  rateAuditQueryKey,
  type RateAuditForm,
  type RateAuditQuery,
} from "@/lib/cashback-rate-audit";
import { formatDateTime, formatUsd } from "@/lib/utils";
import type {
  CashbackRateAuditAffectedUser,
  CashbackRateAuditResult,
  CashbackTopUpJobStatus,
  CashbackTopUpOutcome,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_FORM: RateAuditForm = {
  ratePct: "",
  fromDate: "",
  toDate: "",
  transactionIds: "",
  monthlyCapUsd: "",
  includeUsersWithDebt: false,
};

/** How often the sending job is polled while it runs. */
const JOB_POLL_MS = 3_000;

const percent = (fraction: number) => `${+(fraction * 100).toFixed(3)}%`;

/**
 * Top up cashback that was paid at the wrong rate: preview who is owed what,
 * then send it.
 *
 * ## Why this exists
 *
 * A cashback row's rate is fixed when the purchase settles, and a paid row is
 * never re-priced — the per-purchase rate override leaves it alone. When the
 * rate was wrong (on Oct 20 2026 a Fuse RPC outage graded Prime lock holders
 * Core, and two purchases paid 3% instead of 4%), the only correction is a new
 * top-up row for the difference. The backend's rate audit does that; this puts
 * it behind a preview instead of a hand-written API call.
 *
 * ## Preview, then pay
 *
 * Preview is a dry run: nothing changes. Pay sends exactly the request that was
 * previewed, and only while the form still matches it. The corrections go out
 * as soUSD from the payout wallet straight away — not through the payout queue —
 * so the confirm step says what will move. A re-run never pays a row twice.
 */
export default function CashbackRateTopUpBulk() {
  const [form, setForm] = useState<RateAuditForm>(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [preview, setPreview] = useState<{
    key: string;
    query: RateAuditQuery;
    result: CashbackRateAuditResult;
  } | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [payment, setPayment] = useState<{
    key: string;
    result: CashbackRateAuditResult;
  } | null>(null);
  const [resumedJob, setResumedJob] = useState<CashbackTopUpJobStatus | null>(
    null,
  );

  const built = useMemo(() => buildRateAuditQuery(form), [form]);
  const currentKey = built.query ? rateAuditQueryKey(built.query) : null;
  const isPreviewCurrent = !!preview && preview.key === currentKey;
  const isPaid = !!payment && payment.key === preview?.key;

  const update = <K extends keyof RateAuditForm>(
    field: K,
    value: RateAuditForm[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const previewMutation = useMutation({
    mutationFn: async (query: RateAuditQuery) =>
      (await auditCashbackRate({ ...query, dryRun: true })).data,
    onSuccess: (result, query) => {
      setPreview({ key: rateAuditQueryKey(query), query, result });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (query: RateAuditQuery) =>
      (await auditCashbackRate({ ...query, dryRun: false })).data,
    onSuccess: (result, query) => {
      setPayment({ key: rateAuditQueryKey(query), result });
      setResumedJob(null);
      setIsConfirmOpen(false);
      if (result.claimed > 0) {
        toast.success(
          `Sending ${formatUsd(result.topUpUsd)} across ${result.claimed} correction${
            result.claimed === 1 ? "" : "s"
          }`,
        );
      } else {
        toast.warning("Nothing to send — every row was already topped up");
      }
    },
    onError: () => {
      // The API layer shows the server's message; keep the dialog open so the
      // admin can retry.
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => (await resumeCashbackRateAudit()).data,
    onSuccess: (job) => {
      setResumedJob(job);
      toast.success(
        job.total > 0
          ? `Finishing ${job.total} unsent correction${job.total === 1 ? "" : "s"}`
          : "No unsent corrections were waiting",
      );
    },
  });

  const runPreview = () => {
    setShowErrors(true);
    if (!built.query) return;
    previewMutation.mutate(built.query);
  };

  const errors = showErrors ? built.errors : {};
  const result = preview?.result;
  const recipients = result
    ? payableUserCount(result, !!preview?.query.includeUsersWithDebt)
    : 0;
  const canPay =
    isPreviewCurrent &&
    !isPaid &&
    !!result &&
    result.payableRows > 0 &&
    !payMutation.isPending;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        For purchases whose cashback was paid at the wrong rate. Preview shows
        who is owed what and changes nothing; corrections are sent only after
        you confirm, as soUSD from the payout wallet, and count toward each
        cardholder&apos;s cap for this month.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id="rate-audit-rate"
          label="Rate they should have earned (%)"
          error={errors.ratePct}
        >
          <Input
            id="rate-audit-rate"
            inputMode="decimal"
            value={form.ratePct}
            onChange={(event) => update("ratePct", event.target.value)}
            placeholder="4"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="rate-audit-from"
            label="Settled from (UTC)"
            error={errors.fromDate}
          >
            <Input
              id="rate-audit-from"
              type="date"
              value={form.fromDate}
              onChange={(event) => update("fromDate", event.target.value)}
            />
          </Field>
          <Field
            id="rate-audit-to"
            label="to, including (UTC)"
            error={errors.toDate}
          >
            <Input
              id="rate-audit-to"
              type="date"
              value={form.toDate}
              onChange={(event) => update("toDate", event.target.value)}
            />
          </Field>
        </div>

        <Field
          id="rate-audit-ids"
          label="Transaction ids"
          hint="One per line, or separated by commas. card- prefixes are fine. Leave empty to audit every credited purchase in the window."
          error={errors.transactionIds}
          className="md:col-span-2"
        >
          <Textarea
            id="rate-audit-ids"
            value={form.transactionIds}
            onChange={(event) => update("transactionIds", event.target.value)}
            placeholder="06275d99-3a15-4645-a700-27627f24988d"
            rows={3}
            className="font-mono text-xs"
          />
        </Field>

        <Field
          id="rate-audit-cap"
          label="Monthly cap override (USD)"
          hint="Empty applies each cardholder's tier cap."
          error={errors.monthlyCapUsd}
        >
          <Input
            id="rate-audit-cap"
            inputMode="decimal"
            value={form.monthlyCapUsd}
            onChange={(event) => update("monthlyCapUsd", event.target.value)}
            placeholder="Tier cap"
          />
        </Field>

        <div className="flex items-start gap-2 pt-6">
          <Checkbox
            id="rate-audit-debt"
            checked={form.includeUsersWithDebt}
            onCheckedChange={(checked) =>
              update("includeUsersWithDebt", checked === true)
            }
          />
          <div className="space-y-0.5">
            <Label htmlFor="rate-audit-debt">
              Pay cardholders who owe cashback debt
            </Label>
            <p className="text-xs text-gray-500">
              Off by default: a direct send skips the debt deduction the payout
              queue would apply.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={runPreview}
          disabled={previewMutation.isPending}
          className="cursor-pointer"
        >
          {previewMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Preview
        </Button>
        {result && (
          <Button
            variant="destructive"
            onClick={() => setIsConfirmOpen(true)}
            disabled={!canPay}
            className="cursor-pointer"
            title={
              !isPreviewCurrent
                ? "The form changed since this preview. Preview again to pay."
                : isPaid
                  ? "Already sent. Preview again to check for anything left."
                  : result.payableRows === 0
                    ? "Nothing in this preview can be paid."
                    : undefined
            }
          >
            <Send className="h-4 w-4" />
            Pay {formatUsd(result.topUpUsd)}
          </Button>
        )}
        {preview && !isPreviewCurrent && (
          <span className="text-xs text-amber-700">
            The form changed since this preview. Preview again to pay.
          </span>
        )}
      </div>

      {result && <PreviewResult result={result} />}

      {payment && (
        <PaymentStatus
          payment={payment.result}
          users={result?.affectedUsers ?? []}
          resumedJob={resumedJob}
          onResume={() => resumeMutation.mutate()}
          isResuming={resumeMutation.isPending}
        />
      )}

      {preview && result && (
        <Dialog
          open={isConfirmOpen}
          onOpenChange={(next) => {
            if (!payMutation.isPending) setIsConfirmOpen(next);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Send {formatUsd(result.topUpUsd)} to {recipients} cardholder
                {recipients === 1 ? "" : "s"}?
              </DialogTitle>
              <DialogDescription>
                {result.payableRows} correction
                {result.payableRows === 1 ? "" : "s"} topping purchases settled{" "}
                {describeRateAuditWindow(result.window.from, result.window.to)}{" "}
                up to {percent(result.expectedRate)}.
              </DialogDescription>
            </DialogHeader>

            <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-600">
              <li>
                Sent now as soUSD from the payout wallet, one transfer per
                purchase. It doesn&apos;t wait for the payout queue and
                can&apos;t be recalled once sent.
              </li>
              <li>
                {result.transactionIdsRequested === null ? (
                  <span className="font-medium text-amber-700">
                    No transaction ids: every short-paid purchase in the window
                    is included.
                  </span>
                ) : (
                  `Limited to the ${result.transactionIdsRequested} transaction id${
                    result.transactionIdsRequested === 1 ? "" : "s"
                  } you entered.`
                )}
              </li>
              <li>
                Counts toward each cardholder&apos;s cashback cap for this month
                {result.monthlyCapUsd !== null &&
                  ` (overridden to ${formatUsd(result.monthlyCapUsd)} for this run)`}
                .
              </li>
              <li>
                Running it again won&apos;t pay twice: topped-up rows are
                skipped.
              </li>
            </ul>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                disabled={payMutation.isPending}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => payMutation.mutate(preview.query)}
                disabled={payMutation.isPending || !canPay}
                className="cursor-pointer"
              >
                {payMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Send {formatUsd(result.topUpUsd)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Cardholders this run will actually send to: an account with a Safe, not
 * skipped for debt, and with cap headroom left.
 */
function payableUserCount(
  result: CashbackRateAuditResult,
  includeUsersWithDebt: boolean,
): number {
  return result.affectedUsers.filter((user) => {
    if (!user.payable) return false;
    if (user.hasActiveDebt && !includeUsersWithDebt) return false;
    const cap = result.capByCustomer.find(
      (entry) => entry.userId === user.userId,
    );
    return !cap || cap.allowedUsd > 0;
  }).length;
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

/** What a dry run found: who is owed what, and what will actually be sent. */
function PreviewResult({ result }: { result: CashbackRateAuditResult }) {
  const rates = Object.entries(result.ratesObserved);

  return (
    <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
        <Badge variant="info">Preview — nothing sent</Badge>
        <span>
          Settled{" "}
          {describeRateAuditWindow(result.window.from, result.window.to)} (UTC)
        </span>
        <span>· expected {percent(result.expectedRate)}</span>
        {result.transactionIdsRequested === null ? (
          <span className="font-medium text-amber-700">
            · whole window, no id filter
          </span>
        ) : (
          <span>
            · {result.transactionIdsRequested} transaction id
            {result.transactionIdsRequested === 1 ? "" : "s"}
          </span>
        )}
        <span>
          ·{" "}
          {result.monthlyCapUsd === null
            ? "tier caps"
            : `cap ${formatUsd(result.monthlyCapUsd)}`}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="To send"
          value={formatUsd(result.topUpUsd)}
          detail={`${result.payableRows} correction${result.payableRows === 1 ? "" : "s"}`}
          emphasis
        />
        <Stat
          label="Short-paid"
          value={`${result.underpaid} of ${result.audited}`}
          detail={`purchases checked · ${result.alreadyToppedUp} already topped up`}
        />
        <Stat
          label="Paid → owed"
          value={`${formatUsd(result.paidUsd)} → ${formatUsd(result.owedUsd)}`}
          detail={`on ${formatUsd(result.spendUsd)} of spend${
            rates.length > 0
              ? ` · paid at ${rates
                  .map(([rate, rows]) => `${percent(Number(rate))} × ${rows}`)
                  .join(", ")}`
              : ""
          }`}
        />
      </div>

      {(result.capBlockedRows > 0 ||
        result.capClampedRows > 0 ||
        result.unpayableUsers > 0 ||
        result.usersWithActiveDebt > 0) && (
        <ul className="space-y-1 text-xs text-amber-800">
          {result.capBlockedRows > 0 && (
            <li>
              {result.capBlockedRows} row
              {result.capBlockedRows === 1 ? "" : "s"} dropped: the
              cardholder&apos;s monthly cap is used up.
            </li>
          )}
          {result.capClampedRows > 0 && (
            <li>
              {result.capClampedRows} row
              {result.capClampedRows === 1 ? "" : "s"} paid less than owed: the
              cap ran out part-way.
            </li>
          )}
          {result.unpayableUsers > 0 && (
            <li>
              {result.unpayableUsers} cardholder
              {result.unpayableUsers === 1 ? " has" : "s have"} no account or
              Safe to send to.
            </li>
          )}
          {result.usersWithActiveDebt > 0 && (
            <li>
              {result.usersWithActiveDebt} cardholder
              {result.usersWithActiveDebt === 1 ? " owes" : "s owe"} cashback
              debt and {result.usersWithActiveDebt === 1 ? "is" : "are"}{" "}
              skipped.
            </li>
          )}
        </ul>
      )}

      {result.affectedUsers.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-gray-500">
          Nobody was short-paid at {percent(result.expectedRate)} in this
          window.
        </p>
      ) : (
        <div className="max-h-[50vh] overflow-auto rounded-md border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cardholder</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead className="text-right">Top-up</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.affectedUsers.map((user) => (
                <AffectedUserRow
                  key={user.userId}
                  user={user}
                  cap={result.capByCustomer.find(
                    (cap) => cap.userId === user.userId,
                  )}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {result.affectedEmails.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {result.affectedEmails.length} email
          {result.affectedEmails.length === 1 ? "" : "s"} for a support reply
          <CopyButton
            value={result.affectedEmails.join(", ")}
            label="Affected emails"
          />
        </div>
      )}

      {result.skipped.length > 0 && (
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer">
            {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"}{" "}
            skipped
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {result.skipped.map((row) => (
              <li key={row.cashbackId}>
                <span className="font-mono">
                  {row.transactionId ?? row.cashbackId}
                </span>{" "}
                — {row.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  emphasis,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`tabular-nums ${
          emphasis
            ? "text-lg font-semibold text-gray-900"
            : "font-medium text-gray-900"
        }`}
      >
        {value}
      </div>
      {detail && <div className="text-xs text-gray-500">{detail}</div>}
    </div>
  );
}

function AffectedUserRow({
  user,
  cap,
}: {
  user: CashbackRateAuditAffectedUser;
  cap?: CashbackRateAuditResult["capByCustomer"][number];
}) {
  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/users/${user.userId}`}
          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {user.username ?? "Unknown user"}
        </Link>
        {user.email && (
          <div className="text-xs text-gray-500">{user.email}</div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{user.rows}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(user.paidUsd)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(user.owedUsd)}
      </TableCell>
      <TableCell className="text-right font-medium text-gray-900 tabular-nums">
        {formatUsd(user.topUpUsd)}
        {cap && (
          <div className="text-xs font-normal text-amber-700">
            {formatUsd(cap.allowedUsd)} after cap
          </div>
        )}
      </TableCell>
      <TableCell className="space-x-1 text-right">
        {!user.payable && <Badge variant="danger">No Safe</Badge>}
        {user.hasActiveDebt && <Badge variant="warning">Owes debt</Badge>}
      </TableCell>
    </TableRow>
  );
}

const OUTCOME_BADGE: Record<
  CashbackTopUpOutcome["status"],
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  paid: { label: "Paid", variant: "success" },
  failed: { label: "Not sent", variant: "warning" },
  "sent-unrecorded": { label: "Sent, not recorded", variant: "danger" },
};

/** The real run: what was claimed, and the sending job's progress. */
function PaymentStatus({
  payment,
  users,
  resumedJob,
  onResume,
  isResuming,
}: {
  payment: CashbackRateAuditResult;
  users: CashbackRateAuditAffectedUser[];
  resumedJob: CashbackTopUpJobStatus | null;
  onResume: () => void;
  isResuming: boolean;
}) {
  const jobId = payment.jobId;

  const jobQuery = useQuery({
    queryKey: ["cashback-rate-audit-job", jobId],
    queryFn: async () => (await getCashbackRateAuditJob(jobId!)).data,
    enabled: !!jobId && !resumedJob,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && "state" in data && data.state === "completed"
        ? false
        : JOB_POLL_MS;
    },
  });

  if (!jobId) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-gray-700">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Nothing was sent
        </p>
        <p className="mt-1">
          Every short-paid purchase was already topped up, or another run
          claimed it first. Preview again to see what is left.
        </p>
      </div>
    );
  }

  const data = resumedJob ?? jobQuery.data;
  const lost = !!data && "error" in data;
  const job = data && "state" in data ? data : null;

  return (
    <div
      className={`space-y-3 rounded-md border px-4 py-3 text-sm ${
        job?.state === "completed" &&
        job.failed === 0 &&
        job.needsReconciliation === 0
          ? "border-emerald-200 bg-emerald-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          {job?.state === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : lost ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          )}
          {job
            ? `${job.state === "completed" ? "Sent" : "Sending"} ${job.sent} of ${
                job.total
              } · ${formatUsd(job.topUpUsd)}`
            : `Sending ${payment.claimed} correction${
                payment.claimed === 1 ? "" : "s"
              } · ${formatUsd(payment.topUpUsd)}`}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-500">{jobId}</span>
          <CopyButton value={jobId} label="Job id" />
          {!resumedJob && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => void jobQuery.refetch()}
              disabled={jobQuery.isFetching}
              className="cursor-pointer"
            >
              <RefreshCw
                className={`h-3 w-3 ${jobQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {payment.claimed < payment.payableRows && (
        <p className="text-xs text-gray-600">
          {payment.payableRows - payment.claimed} of the {payment.payableRows}{" "}
          corrections had already been claimed by another run and are not in
          this job.
        </p>
      )}

      {lost && (
        <div className="space-y-2 text-xs text-gray-700">
          <p>
            {(data as { error: string }).error} If the service restarted
            mid-job, corrections it claimed but didn&apos;t send can be finished
            from here.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onResume}
            disabled={isResuming}
            className="cursor-pointer"
          >
            {isResuming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Finish unsent corrections
          </Button>
        </div>
      )}

      {jobQuery.isError && !resumedJob && (
        <p className="text-xs text-red-600">
          Couldn&apos;t read the job&apos;s progress. Refresh to try again.
        </p>
      )}

      {job && job.needsReconciliation > 0 && (
        <p className="text-xs font-medium text-red-700">
          {job.needsReconciliation} transfer
          {job.needsReconciliation === 1 ? "" : "s"} went out but couldn&apos;t
          be recorded. The row stays Pending with its hash and nothing will
          resend it — close it out by hand.
        </p>
      )}
      {job && job.failed > 0 && (
        <p className="text-xs text-amber-800">
          {job.failed} not sent; left Failed for the retry cron to pay.
        </p>
      )}

      {job && job.outcomes.length > 0 && (
        <div className="overflow-auto rounded-md border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cardholder</TableHead>
                <TableHead>Purchase</TableHead>
                <TableHead className="text-right">Top-up</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.outcomes.map((outcome) => (
                <OutcomeRow
                  key={outcome.topUpTransactionId}
                  outcome={outcome}
                  username={
                    users.find((user) => user.userId === outcome.userId)
                      ?.username
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {job?.finishedAt && (
        <p className="text-xs text-gray-500">
          Finished {formatDateTime(job.finishedAt)}
          {job.requestedBy && ` · run by ${job.requestedBy}`}
        </p>
      )}
    </div>
  );
}

function OutcomeRow({
  outcome,
  username,
}: {
  outcome: CashbackTopUpOutcome;
  username?: string;
}) {
  const badge = OUTCOME_BADGE[outcome.status];

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/users/${outcome.userId}`}
          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {username ?? outcome.userId}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {outcome.originalTransactionId}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(outcome.topUpUsd)}
        {outcome.soUsdAmount && (
          <div className="text-xs text-gray-500">
            {outcome.soUsdAmount} soUSD
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {outcome.txHash && (
            <a
              href={`https://explorer.fuse.io/tx/${outcome.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              Tx <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {outcome.error && (
          <div className="mt-0.5 text-xs text-red-600">{outcome.error}</div>
        )}
      </TableCell>
    </TableRow>
  );
}
