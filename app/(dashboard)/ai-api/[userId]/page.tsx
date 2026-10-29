"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

import AiApiUsageChart from "@/components/ai-api/usage-chart";
import ReasonDialog, { ReasonDialogRequest } from "@/components/ai-api/reason-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import UserLink from "@/components/user-link";
import {
  useAiApiAccountAction,
  useAiApiKeyAction,
  useAiApiKeyLimit,
  useAiApiUser,
} from "@/hooks/use-ai-api";
import {
  CASHBACK_STATUS,
  CHARGE_FAILURE_LABELS,
  CHARGE_STATUS,
  formatDay,
  formatTokens,
  KEY_STATUS,
  PAUSE_REASON_LABELS,
} from "@/lib/ai-api";
import { formatCashbackRate } from "@/lib/cashback-percentage";
import { formatDateTime, formatUsd } from "@/lib/utils";
import type {
  AiApiAccountAction,
  AiApiAdminCharge,
  AiApiAdminKey,
  AiApiKeyAction,
} from "@/types/ai-api";

/** Billing runs on Base: the module, the Safe it charges, and each charge. */
const BILLING_EXPLORER = "https://basescan.org";
/** Cashback is paid in soUSD on Fuse, the payout card cashback already uses. */
const CASHBACK_EXPLORER = "https://explorer.fuse.io";

type PendingAction =
  | { kind: "key"; key: AiApiAdminKey; action: AiApiKeyAction }
  | { kind: "limit"; key: AiApiAdminKey }
  | { kind: "account"; action: AiApiAccountAction };

function Card({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{children}</div>
    </div>
  );
}

const chargeDays = (charge: AiApiAdminCharge) =>
  charge.fromDay === charge.toDay
    ? formatDay(charge.toDay)
    : `${formatDay(charge.fromDay)} – ${formatDay(charge.toDay)}`;

function describe(pending: PendingAction, username: string): ReasonDialogRequest {
  if (pending.kind === "limit") {
    return {
      title: `Lower the limit on “${pending.key.name}”`,
      description: `It has spent ${formatUsd(pending.key.spentThisMonthUsd)} of ${formatUsd(
        pending.key.monthlyLimitUsd,
        0,
      )} this month. A limit at or below what it has spent stops it until the 1st. The user is not told.`,
      confirmText: "Lower limit",
      limitBelowUsd: pending.key.monthlyLimitUsd,
    };
  }
  if (pending.kind === "key") {
    const name = `“${pending.key.name}”`;
    switch (pending.action) {
      case "disable":
        return {
          title: `Disable ${name}?`,
          description:
            "Its requests are refused straight away. The user sees it as Disabled and can't turn it back on; you can, from here.",
          confirmText: "Disable key",
          destructive: true,
        };
      case "enable":
        return {
          title: `Enable ${name}?`,
          description: "Its requests are served again, within its monthly limit.",
          confirmText: "Enable key",
        };
      case "revoke":
        return {
          title: `Delete ${name}?`,
          description:
            "The key stops working for good and disappears from the user's app. What it already used is still charged, and its cashback still paid. This can't be undone.",
          confirmText: "Delete key",
          destructive: true,
        };
    }
  }
  switch (pending.action) {
    case "pause":
      return {
        title: `Pause ${username}'s AI API?`,
        description:
          "Every key on the account stops at once. The app tells them the team paused it and to contact support. Only an admin can resume it.",
        confirmText: "Pause account",
        destructive: true,
      };
    case "resume":
      return {
        title: `Resume ${username}'s AI API?`,
        description:
          "Their keys work again. If a charge is still waiting, it is tried at the next billing run, and a refusal pauses the account again.",
        confirmText: "Resume",
      };
    case "retry-charge":
      return {
        title: "Retry the waiting charge now?",
        description:
          "Charges the user's Wallet for what is waiting, now rather than at the next hourly run. If it goes through and the account was paused for billing, it resumes.",
        confirmText: "Retry charge",
      };
  }
}

/**
 * One user's AI API: their keys and what each spent, the charges taken from
 * their Wallet and the cashback on them, and the mandate those run under.
 */
export default function AiApiUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { data, isLoading, error } = useAiApiUser(userId);
  const keyAction = useAiApiKeyAction(userId);
  const keyLimit = useAiApiKeyLimit(userId);
  const accountAction = useAiApiAccountAction(userId);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const isSaving = keyAction.isPending || keyLimit.isPending || accountAction.isPending;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/ai-api" className="inline-flex items-center gap-1 text-sm text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> AI API
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load this user&apos;s AI API.
        </div>
      </div>
    );
  }

  const { data: view, canEdit } = data;
  const username = view.user.username ?? view.user.email ?? userId;
  const { billing, account } = view;

  const confirm = async (input: { reason: string; monthlyLimitUsd?: number }) => {
    if (!pending) return;
    try {
      if (pending.kind === "limit") {
        await keyLimit.mutateAsync({
          keyId: pending.key.id,
          monthlyLimitUsd: input.monthlyLimitUsd ?? 0,
          reason: input.reason,
        });
        toast.success(`Limit lowered on ${pending.key.name}`);
      } else if (pending.kind === "key") {
        await keyAction.mutateAsync({
          keyId: pending.key.id,
          action: pending.action,
          reason: input.reason,
        });
        toast.success(`${pending.key.name}: ${pending.action === "revoke" ? "deleted" : `${pending.action}d`}`);
      } else {
        await accountAction.mutateAsync({ action: pending.action, reason: input.reason });
        toast.success(
          pending.action === "retry-charge"
            ? "Charge retried. The result is in the charges below."
            : `AI API ${pending.action === "pause" ? "paused" : "resumed"}`,
        );
      }
      setPending(null);
    } catch {
      // The API layer shows the server's reason; the dialog stays open.
    }
  };

  const liveKeys = view.keys.filter((key) => !key.revokedAt);
  const deletedKeys = view.keys.filter((key) => key.revokedAt);

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-2">
        <Link href="/ai-api" className="inline-flex items-center gap-1 text-sm text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> AI API
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            <UserLink userId={userId} username={view.user.username} className="text-2xl" />
          </h1>
          {account.paused ? (
            <Badge variant="warning">
              Paused · {account.pausedReason ? PAUSE_REASON_LABELS[account.pausedReason] : "unknown"}
            </Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
          {!view.available ? <Badge variant="muted">Not available to this user</Badge> : null}
        </div>
        {view.user.email ? <p className="text-sm text-gray-500">{view.user.email}</p> : null}
      </div>

      {!canEdit ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can view this user&apos;s AI API but not change it. Changes are limited to the
          admins in AI_API_ADMIN_EMAILS.
        </div>
      ) : null}

      <Card
        title="Account"
        description={
          account.paused && account.pausedAt
            ? `Paused ${formatDateTime(account.pausedAt)}${account.pausedBy ? ` by ${account.pausedBy}` : ""}.`
            : undefined
        }
        actions={
          canEdit ? (
            <>
              {billing.openChargeUsd > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setPending({ kind: "account", action: "retry-charge" })}
                  className="cursor-pointer"
                >
                  Retry waiting charge
                </Button>
              ) : null}
              {account.paused ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setPending({ kind: "account", action: "resume" })}
                  className="cursor-pointer"
                >
                  Resume
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isSaving}
                  onClick={() => setPending({ kind: "account", action: "pause" })}
                  className="cursor-pointer"
                >
                  Pause
                </Button>
              )}
            </>
          ) : null
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label={`Billed in ${view.month.key}`}>
            {formatUsd(view.month.spentUsd)} · {view.month.requests.toLocaleString()} requests
          </Fact>
          <Fact label="Cashback">
            {formatUsd(view.cashback.paidUsd)} paid · {formatUsd(view.cashback.pendingUsd)} pending
          </Fact>
          <Fact label="Cashback terms">
            {view.cashback.tier} · {formatCashbackRate(view.cashback.rate)} back,{" "}
            {view.cashback.monthlyCapUsd > 0
              ? `up to ${formatUsd(view.cashback.monthlyCapUsd, 0)} a month`
              : "no monthly cap"}
          </Fact>
          <Fact label="Waiting to be charged">{formatUsd(billing.openChargeUsd)}</Fact>
          <Fact
            label={`Wallet on Base (${
              billing.billingTokens.length ? billing.billingTokens.join(", then ") : "billing tokens"
            })`}
          >
            {billing.walletBalanceUsd === null ? "—" : formatUsd(billing.walletBalanceUsd)}{" "}
            {billing.walletShort ? (
              <Badge variant="warning" title="Requests are refused until the Wallet covers unpaid usage">
                Short
              </Badge>
            ) : null}
          </Fact>
          <Fact label="Mandate">
            {billing.mandate?.registered
              ? `${formatUsd(billing.mandate.maxPerPeriodUsd, 0)} per ${Math.round(
                  billing.mandate.periodSeconds / 3600,
                )}h${billing.mandate.paused ? " · paused" : ""}${
                  billing.mandate.cancelled ? " · cancelled" : ""
                }`
              : billing.configured
                ? "Not signed"
                : "Billing not configured"}
          </Fact>
          <Fact label="Mandate needed">
            {formatUsd(billing.requiredMandateUsd, 0)}{" "}
            {billing.needsMandate ? (
              <Badge variant="warning">Short</Badge>
            ) : (
              <Badge variant="success">Covered</Badge>
            )}
          </Fact>
          <Fact label="Billing module">
            {billing.moduleAddress ? (
              <a
                href={`${BILLING_EXPLORER}/address/${billing.moduleAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
              >
                {billing.moduleAddress.slice(0, 6)}…{billing.moduleAddress.slice(-4)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "—"
            )}
            {billing.mandate ? (billing.mandate.moduleEnabled ? " · enabled" : " · not enabled") : ""}
          </Fact>
          <Fact label="Safe">
            {view.user.safeAddress ? (
              <span className="inline-flex items-center gap-1">
                <a
                  href={`${BILLING_EXPLORER}/address/${view.user.safeAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {view.user.safeAddress.slice(0, 6)}…{view.user.safeAddress.slice(-4)}
                </a>
                <CopyButton value={view.user.safeAddress} />
              </span>
            ) : (
              "—"
            )}
          </Fact>
        </div>
      </Card>

      <Card title="Billed per day" description={`${view.month.key}, so far.`}>
        <AiApiUsageChart
          data={view.daily.map((day) => ({ day: day.day, billedUsd: day.spentUsd }))}
          height={200}
        />
      </Card>

      <Card title="Keys" description="Limits can only be lowered here. Raising one needs a mandate only the user can sign.">
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Key</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">This month</th>
                <th className="px-4 py-2 text-right">Requests</th>
                <th className="px-4 py-2">Last used</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {liveKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No live keys.
                  </td>
                </tr>
              ) : null}
              {liveKeys.map((key) => (
                <tr key={key.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{key.name}</div>
                    <div className="font-mono text-xs text-gray-500">sk_solid_ai_…{key.last4}</div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={KEY_STATUS[key.status].variant}>{KEY_STATUS[key.status].label}</Badge>
                    {key.disabledReason ? (
                      <div className="mt-1 max-w-48 text-xs text-gray-500" title={key.disabledReason}>
                        {key.disabledBy ? `${key.disabledBy}: ` : ""}
                        {key.disabledReason}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatUsd(key.spentThisMonthUsd)} / {formatUsd(key.monthlyLimitUsd, 0)}
                  </td>
                  <td className="px-4 py-2 text-right">{key.requestsThisMonth.toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(key.createdAt)}</td>
                  <td className="px-4 py-2">
                    {canEdit ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving || key.monthlyLimitUsd <= 1}
                          onClick={() => setPending({ kind: "limit", key })}
                          className="cursor-pointer"
                        >
                          Lower limit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() =>
                            setPending({
                              kind: "key",
                              key,
                              action: key.disabledAt ? "enable" : "disable",
                            })
                          }
                          className="cursor-pointer"
                        >
                          {key.disabledAt ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isSaving}
                          onClick={() => setPending({ kind: "key", key, action: "revoke" })}
                          className="cursor-pointer"
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {deletedKeys.length > 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            Deleted:{" "}
            {deletedKeys
              .map((key) => `${key.name} (…${key.last4}, ${formatDateTime(key.revokedAt ?? "")})`)
              .join(", ")}
          </p>
        ) : null}
      </Card>

      {view.topModels.length > 0 ? (
        <Card title="Models this month">
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2 text-right">Requests</th>
                  <th className="px-4 py-2 text-right">Tokens</th>
                  <th className="px-4 py-2 text-right">Billed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {view.topModels.map((model) => (
                  <tr key={model.model}>
                    <td className="px-4 py-2 font-medium text-gray-900">{model.name}</td>
                    <td className="px-4 py-2 text-right">{model.requests.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{formatTokens(model.tokens)}</td>
                    <td className="px-4 py-2 text-right">{formatUsd(model.spentUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card
        title="Charges"
        description="Taken from the Wallet every few dollars of usage, and at each day's close. Newest first."
      >
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Days</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Keys</th>
                <th className="px-4 py-2">Cashback</th>
                <th className="px-4 py-2">Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {view.charges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No charges yet.
                  </td>
                </tr>
              ) : null}
              {view.charges.map((charge) => (
                <tr key={charge.id} className="align-top">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{chargeDays(charge)}</div>
                    <div className="text-xs text-gray-500">
                      {charge.requests.toLocaleString()} requests
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{formatUsd(charge.amountUsd)}</td>
                  <td className="px-4 py-2">
                    <Badge variant={CHARGE_STATUS[charge.status].variant}>
                      {CHARGE_STATUS[charge.status].label}
                    </Badge>
                    {charge.failure ? (
                      <div className="mt-1 text-xs text-amber-700">
                        {CHARGE_FAILURE_LABELS[charge.failure]}
                        {charge.attempts > 0 ? ` · ${charge.attempts} attempts` : ""}
                      </div>
                    ) : null}
                    {charge.lastError && charge.status !== "charged" ? (
                      <div className="mt-1 max-w-64 truncate text-xs text-gray-500" title={charge.lastError}>
                        {charge.lastError}
                      </div>
                    ) : null}
                    {charge.nextAttemptAt && charge.status === "open" ? (
                      <div className="text-xs text-gray-500">
                        Next try {formatDateTime(charge.nextAttemptAt)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {charge.keys.map((line) => (
                      <div key={line.keyId}>
                        {line.name}: {formatUsd(line.amountUsd)}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2">
                    {charge.cashbackStatus === "none" ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <>
                        <div className="font-medium">{formatUsd(charge.cashbackUsd)}</div>
                        <Badge variant={CASHBACK_STATUS[charge.cashbackStatus].variant}>
                          {CASHBACK_STATUS[charge.cashbackStatus].label}
                        </Badge>
                        <div className="mt-1 text-xs text-gray-500">
                          {charge.cashbackPaidAt
                            ? `Paid ${formatDateTime(charge.cashbackPaidAt)}`
                            : charge.cashbackPayoutAt
                              ? `Due ${formatDateTime(charge.cashbackPayoutAt)}`
                              : null}
                        </div>
                        {charge.cashbackLastError ? (
                          <div
                            className="max-w-48 truncate text-xs text-red-600"
                            title={charge.cashbackLastError}
                          >
                            {charge.cashbackLastError}
                          </div>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {charge.transactionHash ? (
                      <a
                        href={`${BILLING_EXPLORER}/tx/${charge.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                      >
                        Charge <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {charge.cashbackTxHash ? (
                      <a
                        href={`${CASHBACK_EXPLORER}/tx/${charge.cashbackTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex items-center gap-1 text-indigo-600 hover:underline"
                      >
                        Cashback <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {charge.chargedAt ? (
                      <div className="mt-1 text-gray-500">{formatDateTime(charge.chargedAt)}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ReasonDialog
        request={pending ? describe(pending, username) : null}
        pending={isSaving}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
