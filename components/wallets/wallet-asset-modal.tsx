"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  RefundQueueItem,
  RefundQueueResponse,
  WalletAsset,
  WalletAssetFlow,
  WalletFailureEvent,
  WalletInfo,
  WalletOwedNow,
  WalletTransfer,
} from "@/types";
import {
  formatAge,
  formatAmount,
  formatAtLeast,
  formatDateTime,
  formatRunway,
  formatWalletUsd,
  getWalletFailures,
  getWalletForecast,
  getWalletTransfers,
  truncateAddress,
} from "@/lib/wallets";
import { useDebounce } from "@/hooks/use-debounce";

type TabKey = "funding" | "spending" | "affected" | "forecast";

const TABS: Array<{ key: TabKey; label: string; hint: string }> = [
  {
    key: "funding",
    label: "Funding in",
    hint: "Who topped this up, when, and how much",
  },
  {
    key: "spending",
    label: "Spending out",
    hint: "Where the balance went",
  },
  {
    key: "affected",
    label: "Affected users",
    hint: "Whose action failed because this ran dry",
  },
  {
    key: "forecast",
    label: "Forecast",
    hint: "What this wallet still has to pay, and when",
  },
];

interface Props {
  wallet: WalletInfo;
  /** The chain + asset the operator clicked. */
  target: { chainId: number; chainName: string; asset: WalletAsset };
  /** Flow figures for that asset, when the flow call has resolved. */
  flow?: WalletAssetFlow;
  onClose: () => void;
}

/**
 * Everything known about one token, on one chain, on one wallet.
 *
 * The page's whole navigation is "a token, on a chain, on a wallet", so the
 * popup opens on that triple and every tab stays scoped to it. Opening on the
 * wallet instead would mean the operator who clicked the empty soUSD row has to
 * re-find it among four other assets.
 */
export default function WalletAssetModal({
  wallet,
  target,
  flow,
  onClose,
}: Props) {
  const [tab, setTab] = useState<TabKey>("funding");
  const [addressFilter, setAddressFilter] = useState("");
  // Debounced so a pasted address does not fire a request per keystroke; the
  // backend compares lowercased, and so does this, so the operator can paste a
  // checksummed address from one explorer and a lowercased one from another.
  const counterparty = useDebounce(addressFilter.trim().toLowerCase(), 350);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Header
          wallet={wallet}
          target={target}
          flow={flow}
          onClose={onClose}
        />

        <div className="flex gap-1 border-b border-gray-200 px-5">
          {TABS.map((entry) => {
            // On the refund wallet the forecast is the list of refunds still
            // owed, and that is what an operator comes here looking for.
            const isRefundQueue =
              entry.key === "forecast" &&
              wallet.forecastSource === "card_refund";
            return (
              <button
                key={entry.key}
                title={
                  isRefundQueue
                    ? "Every card refund owed and not yet paid"
                    : entry.hint
                }
                onClick={() => setTab(entry.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === entry.key
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {isRefundQueue ? "Refund queue" : entry.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {(tab === "funding" || tab === "spending") && (
            <TransfersTab
              walletName={wallet.name}
              target={target}
              direction={tab === "funding" ? "incoming" : "outgoing"}
              addressFilter={addressFilter}
              onAddressFilterChange={setAddressFilter}
              counterparty={counterparty}
            />
          )}
          {tab === "affected" && (
            <AffectedUsersTab wallet={wallet} chainId={target.chainId} />
          )}
          {tab === "forecast" && <ForecastTab wallet={wallet} />}
        </div>
      </div>
    </div>
  );
}

function Header({
  wallet,
  target,
  flow,
  onClose,
}: Omit<Props, "onClose"> & { onClose: () => void }) {
  const label = flow?.symbol ?? target.asset;

  return (
    <div className="border-b border-gray-200 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {wallet.name} · {target.chainName}
          </p>
          <h2 className="text-lg font-semibold text-gray-900">
            {label}
            {flow && (
              /* The measured floor where there is one: the panel below quotes
                 it, and two different floors for the same asset on the same
                 screen is the confusion this page exists to remove. */
              <span
                className="ml-2 text-sm font-normal text-gray-600"
                title={
                  flow.plan
                    ? flow.plan.floorBasis === "minimum"
                      ? "The minimum set on this asset, which is above its days of cover at the measured cost."
                      : `${flow.plan.floorDays} days at the measured cost. The configured threshold is ${formatAmount(flow.threshold)}.`
                    : "Its configured threshold — no cost has been measured yet."
                }
              >
                {formatAmount(flow.balance)} held against a{" "}
                {formatAmount(flow.plan?.floorAmount ?? flow.threshold)} floor
              </span>
            )}
          </h2>
          {wallet.funds && (
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              {wallet.funds}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {flow && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Cost / day"
            value={
              flow.realCostPerDay != null
                ? formatAmount(flow.realCostPerDay)
                : !flow.isFloat && flow.outflowPerDay > 0
                ? formatAmount(flow.outflowPerDay)
                : "—"
            }
            note={
              (flow.realCostPerDay != null
                ? "measured net of top-ups — what we actually spend"
                : flow.isFloat
                ? "not measured yet; outflow here is users' money, not cost"
                : flow.outflowPerDay > 0
                ? "from transfers out — excludes gas spent as fees"
                : "nothing observed leaving in the window") +
              (flow.observedDays != null && flow.observedDays < 6.5
                ? ` · over ${flow.observedDays.toFixed(1)} days watched`
                : "") +
              (flow.excludedOneOff
                ? ` · leaves out a one-off ${formatAmount(
                    flow.excludedOneOff.amount
                  )} on ${flow.excludedOneOff.timestamp.slice(0, 10)}`
                : "")
            }
          />
          <Stat
            label="Runway"
            value={formatRunway(flow.daysOfRunway)}
            note={
              flow.runwayBasis === "measured"
                ? "at the measured cost"
                : flow.runwayBasis === "outflow"
                ? "at the observed outflow — likely optimistic"
                : flow.snapshotCount < 2
                ? "needs a few hours of balance history"
                : "not draining"
            }
          />
          {/* Turnover gets a tile of its own rather than being folded into
              burn. On a bridging wallet it is the largest number on the
              screen and none of it is money we spent. */}
          <Stat
            label={flow.isFloat ? "Passing through" : "Transfers out"}
            value={
              flow.isFloat
                ? `${formatAmount(flow.turnoverPerDay)}/d`
                : String(flow.outflowCount)
            }
            note={
              flow.isFloat
                ? `${flow.turnoverCount} user transfers in, ${flow.outflowCount} out — not a cost`
                : `${formatAmount(flow.outflowTotal)} ${label} in the window`
            }
          />
          <Stat
            label="Top-ups in"
            value={String(flow.fundingCount)}
            note={`${formatAmount(flow.fundingTotal)} ${label} funded in the window`}
          />
        </div>
      )}

      {flow?.owedNow && flow.owedNow.count + flow.owedNow.failedCount > 0 && (
        <OwedNowNote owed={flow.owedNow} label={label} />
      )}

      {flow?.excludedOneOff && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>
            One transfer of {formatAmount(flow.excludedOneOff.amount)} {label}
          </strong>{" "}
          on {formatDateTime(flow.excludedOneOff.timestamp)} was{" "}
          {Math.round(flow.excludedOneOff.share * 100)}% of everything that left
          in the window, so the daily rate leaves it out — it is not what this
          wallet spends each day.{" "}
          <a
            href={flow.excludedOneOff.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-amber-900 underline"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}

      {flow?.plan && (
        <div
          className={`mt-3 rounded border px-3 py-2 text-xs ${
            flow.plan.belowFloor
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          {flow.plan.refillAmount > 0 ? (
            <>
              <strong>
                Send {formatAtLeast(flow.plan.refillAmount)} {label}
              </strong>{" "}
              {flow.plan.floorBasis === "minimum" ? (
                <>
                  to reach {formatAmount(flow.plan.targetAmount)} {label}, the
                  minimum plus {flow.plan.targetDays - flow.plan.floorDays} days
                  of cover.
                </>
              ) : (
                <>
                  to reach {flow.plan.targetDays} days of cover (
                  {formatAmount(flow.plan.targetAmount)} {label})
                  {flow.plan.owedAmount
                    ? `, on top of ${formatAmount(flow.plan.owedAmount)} ${label} for the queued refunds`
                    : ""}
                  .
                </>
              )}
            </>
          ) : (
            <>
              Covered past{" "}
              {flow.plan.floorBasis === "minimum"
                ? `${formatAmount(flow.plan.targetAmount)} ${label}`
                : `${flow.plan.targetDays} days`}
              . Nothing to send.
            </>
          )}{" "}
          <span className="opacity-80">
            {flow.plan.floorBasis === "minimum" ? (
              <>
                Floor is the {formatAmount(flow.plan.floorAmount)} {label}{" "}
                minimum set on this asset.
              </>
            ) : (
              <>
                Floor is {flow.plan.floorDays} days ={" "}
                {formatAmount(flow.plan.floorAmount)} {label}.
              </>
            )}
          </span>
        </div>
      )}

      {wallet.topUpHint && (
        <p className="mt-3 rounded border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          <strong>How to top up:</strong> {wallet.topUpHint}
        </p>
      )}
    </div>
  );
}

/**
 * Payouts already queued behind this balance, said before anything about
 * cover: it is the smallest send that gets somebody paid.
 */
function OwedNowNote({ owed, label }: { owed: WalletOwedNow; label: string }) {
  const short = owed.clearAmount > 0;
  const what = owed.count === 1 ? "refund" : "refunds";

  return (
    <div
      className={`mt-3 rounded border px-3 py-2 text-xs ${
        short
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      {owed.count > 0 &&
        (short ? (
          <>
            <strong>
              {owed.count} queued {what} ({formatAmount(owed.amount)} {label})
              cannot be paid.
            </strong>{" "}
            Send at least{" "}
            <strong>
              {formatAtLeast(owed.clearAmount)} {label}
            </strong>{" "}
            to clear {owed.count === 1 ? "it" : "them"}
            {owed.oldestAt ? `; the oldest has waited ${formatAge(owed.oldestAt)}` : ""}.
          </>
        ) : (
          <>
            {owed.count} queued {what} ({formatAmount(owed.amount)} {label}) —
            covered, and set aside before the cover below is counted. They pay on
            the next run.
          </>
        ))}
      {owed.failedCount > 0 && (
        <span className="block opacity-80">
          {owed.failedCount} more {owed.failedCount === 1 ? "waits" : "wait"} on
          an operator and {owed.failedCount === 1 ? "is" : "are"} not counted.
        </span>
      )}
      {owed.unpricedCount > 0 && (
        <span className="block opacity-80">
          {owed.unpricedCount} could not be converted to {label} right now and{" "}
          {owed.unpricedCount === 1 ? "is" : "are"} not in the total.
        </span>
      )}
      <span className="block opacity-80">
        The Refund queue tab lists every one of them.
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-900">{value}</p>
      {note && <p className="mt-0.5 text-[11px] leading-tight text-gray-500">{note}</p>}
    </div>
  );
}

function TransfersTab({
  walletName,
  target,
  direction,
  addressFilter,
  onAddressFilterChange,
  counterparty,
}: {
  walletName: string;
  target: Props["target"];
  direction: "incoming" | "outgoing";
  addressFilter: string;
  onAddressFilterChange: (value: string) => void;
  counterparty: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "wallet-transfers",
      walletName,
      target.chainId,
      target.asset,
      direction,
      counterparty,
    ],
    queryFn: () =>
      getWalletTransfers(walletName, {
        chainId: target.chainId,
        asset: target.asset,
        direction,
        ...(counterparty ? { counterparty } : {}),
        limit: 100,
      }),
  });

  /**
   * Every chain this list could not fully cover — whether it has no indexer at
   * all or its lookup failed this time.
   *
   * Keyed on `reason` rather than on `supported`: a chain the backend *can*
   * query but failed to reach still comes back `supported: true`, and filtering
   * on that flag hid exactly the case where the list is silently short. An
   * empty transfer list is indistinguishable from "this wallet was never
   * funded", so any gap has to be said out loud.
   */
  const gaps = (data?.coverage ?? []).filter((row) => row.reason);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={addressFilter}
            onChange={(event) => onAddressFilterChange(event.target.value)}
            placeholder={
              direction === "incoming"
                ? "Filter by sender address — paste one or more, comma separated"
                : "Filter by recipient address — paste one or more, comma separated"
            }
            className="w-full rounded border border-gray-300 py-1.5 pl-8 pr-3 font-mono text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
        {addressFilter && (
          <button
            onClick={() => onAddressFilterChange("")}
            className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* One line per chain: two chains can be short for different reasons,
          and collapsing them onto the first chain's reason misattributes it. */}
      {gaps.map((row) => (
        <p
          key={row.chainId}
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <strong>{row.chainName}:</strong> {row.reason}
        </p>
      ))}

      {isLoading && <Loading />}
      {error != null && !isLoading && (
        <Empty>Could not load transfers. Try again.</Empty>
      )}

      {!isLoading && data && data.transfers.length === 0 && (
        <Empty>
          {counterparty
            ? "No transfers from that address in the range we can see."
            : direction === "incoming"
            ? "No top-ups found. If this wallet was funded, it was on a chain we cannot index — check the explorer."
            : "Nothing has left this balance in the range we can see."}
        </Empty>
      )}

      {!isLoading && data && data.transfers.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">
                {direction === "incoming" ? "From" : "To"}
              </th>
              <th className="py-2 pr-3">Chain</th>
              <th className="py-2">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.transfers.map((transfer) => (
              <TransferRow
                key={`${transfer.hash}-${transfer.counterparty}-${transfer.amount}`}
                transfer={transfer}
                direction={direction}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TransferRow({
  transfer,
  direction,
}: {
  transfer: WalletTransfer;
  direction: "incoming" | "outgoing";
}) {
  return (
    <tr className="align-top">
      <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
        <div>{formatAge(transfer.timestamp)}</div>
        <div className="text-[11px] text-gray-400">
          {formatDateTime(transfer.timestamp)}
        </div>
      </td>
      <td className="py-2 pr-3 whitespace-nowrap font-medium text-gray-900">
        <span className="inline-flex items-center gap-1">
          {direction === "incoming" ? (
            <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 text-gray-500" />
          )}
          {formatAmount(transfer.amount)} {transfer.symbol}
        </span>
      </td>
      <td className="py-2 pr-3">
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
          {truncateAddress(transfer.counterparty)}
        </code>
        {transfer.counterpartyWalletName && (
          // Without this an internal rebalance reads as external funding, which
          // is exactly the reconciliation error this list exists to prevent.
          <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] text-indigo-800">
            our {transfer.counterpartyWalletName}
          </span>
        )}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
        {transfer.chainName}
      </td>
      <td className="py-2">
        <a
          href={transfer.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          View <ExternalLink className="h-3 w-3" />
        </a>
      </td>
    </tr>
  );
}

function AffectedUsersTab({
  wallet,
  chainId,
}: {
  wallet: WalletInfo;
  chainId: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-failures", wallet.name, chainId],
    queryFn: () =>
      getWalletFailures(wallet.name, { chainId, sinceDays: 30, limit: 100 }),
  });

  if (isLoading) return <Loading />;
  if (error != null) return <Empty>Could not load failures. Try again.</Empty>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      {!data.wired ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {data.note}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Users affected"
            value={String(data.summary.affectedUsers)}
            note="distinct users, balance-caused failures only"
          />
          <Stat
            label="Blocked since"
            value={formatAge(data.summary.firstFailureAt)}
            note={
              data.summary.firstFailureAt
                ? formatDateTime(data.summary.firstFailureAt)
                : "no balance-caused failure in the window"
            }
          />
          <Stat
            label="Value stuck"
            value={formatWalletUsd(data.summary.amountUsd)}
            note="what the failed payments were worth"
          />
          <Stat
            label="Other failures"
            value={String(data.summary.total - data.summary.balanceRelated)}
            note="same window, not caused by this balance"
          />
        </div>
      )}

      {data.note && data.wired && (
        <p className="text-xs text-gray-500">{data.note}</p>
      )}

      {data.events.length === 0 ? (
        <Empty>
          {data.wired
            ? "No failures in the last 30 days. Nothing is blocked on this wallet."
            : "Nothing to show until a failure signal is mapped to this wallet."}
        </Empty>
      ) : (
        <div className="divide-y divide-gray-100">
          {data.events.map((event, index) => (
            <FailureRow key={`${event.reference ?? index}`} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function FailureRow({ event }: { event: WalletFailureEvent }) {
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        {event.attributedToBalance && (
          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
            <AlertCircle className="h-3 w-3" /> out of funds
          </span>
        )}
        <span className="font-medium text-gray-900">{event.action}</span>
        <span className="text-xs text-gray-500">
          {formatAge(event.occurredAt)} · {formatDateTime(event.occurredAt)}
        </span>
        {event.amountUsd != null && (
          <span className="text-xs text-gray-600">
            {formatWalletUsd(event.amountUsd)}
          </span>
        )}
      </div>

      {event.userId && (
        <a
          href={`/users/${event.userId}`}
          className="mt-1 inline-block font-mono text-xs text-indigo-600 hover:underline"
        >
          {event.userId}
        </a>
      )}

      <p className="mt-1 break-words text-xs text-gray-700">
        <span className="text-gray-500">Internal: </span>
        {event.internalCause}
      </p>
      {event.userMessage && (
        <p className="mt-1 break-words rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">
          {/* Whether the failure was communicated usefully, or the user was
              simply sent to support, is the point of showing both. */}
          <span className="text-gray-500">User saw: </span>
          {event.userMessage}
        </p>
      )}
    </div>
  );
}

function ForecastTab({ wallet }: { wallet: WalletInfo }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-forecast", wallet.name],
    queryFn: () => getWalletForecast(wallet.name),
  });

  if (isLoading) return <Loading />;
  if (error != null) return <Empty>Could not load the forecast. Try again.</Empty>;
  if (!data) return null;

  if (!data.available) {
    return (
      <div className="space-y-3">
        <Empty>{data.note}</Empty>
        {wallet.impactWhenEmpty && (
          <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <strong>If it empties:</strong> {wallet.impactWhenEmpty}
          </p>
        )}
      </div>
    );
  }

  if (data.refundQueue) {
    return <RefundQueuePanel queue={data.refundQueue} note={data.note} />;
  }

  const shortfall = data.coverage?.shortfallUsd ?? 0;
  const maxBucket = Math.max(...data.byDueDate.map((b) => b.usd), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Overdue now"
          value={formatWalletUsd(data.overdue.usd)}
          note={`${data.overdue.count} already past due`}
        />
        <Stat
          label="Next 10 days"
          value={formatWalletUsd(data.next10Days.usd)}
          note={`${data.next10Days.count} payouts`}
        />
        <Stat
          label="Next 30 days"
          value={formatWalletUsd(data.next30Days.usd)}
          note={`${data.next30Days.count} payouts`}
        />
        <Stat
          label="Held now"
          value={
            data.coverage
              ? `${formatAmount(data.coverage.balance)} ${data.coverage.symbol}`
              : "—"
          }
          note={
            data.coverage?.balanceUsd != null
              ? `${formatWalletUsd(data.coverage.balanceUsd)} at 1:1`
              : "payout asset is not priced here"
          }
        />
      </div>

      {data.coverage?.shortfallUsd != null && (
        <p
          className={`rounded border px-3 py-2 text-sm ${
            shortfall > 0
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-green-200 bg-green-50 text-green-900"
          }`}
        >
          {shortfall > 0 ? (
            <>
              <strong>Short {formatWalletUsd(shortfall)}</strong> against everything
              due in the next 30 days. Top up before{" "}
              {data.coverage.coversUntil ?? "the next sweep"}.
            </>
          ) : (
            <>
              Covers everything due in the next 30 days
              {data.coverage.coversUntil
                ? `, through ${data.coverage.coversUntil}`
                : ""}
              .
            </>
          )}
        </p>
      )}

      {data.coverage?.balanceUsd == null && data.coverage && (
        <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          The payout asset here is {data.coverage.symbol}, whose USD value
          tracks the FUSE price. It is deliberately not converted: a guessed
          rate would call this float healthy on a day it is not. Compare the
          balance against the obligation yourself at the current rate.
        </p>
      )}

      {data.byDueDate.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            Due by date
          </p>
          <div className="space-y-1">
            {data.byDueDate.slice(0, 30).map((bucket) => (
              <div key={bucket.date} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-gray-600">
                  {bucket.date}
                </span>
                <div className="h-3 flex-1 rounded bg-gray-100">
                  <div
                    className="h-3 rounded bg-indigo-400"
                    style={{ width: `${(bucket.usd / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-gray-700">
                  {formatWalletUsd(bucket.usd)}
                </span>
                <span className="w-10 shrink-0 text-right text-gray-400">
                  {bucket.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Every card refund owed and not yet paid, oldest first.
 *
 * The list there was no home for: a refund queued behind an empty payout
 * wallet only surfaced under "Affected users" once it had already failed, and
 * one waiting quietly for its first attempt did not surface at all.
 */
function RefundQueuePanel({
  queue,
  note,
}: {
  queue: RefundQueueResponse;
  note?: string;
}) {
  const usd = queue.owed.byCurrency.USD;
  const eur = queue.owed.byCurrency.EUR;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Owed now"
          value={formatWalletUsd(queue.owed.usd)}
          note={
            queue.owed.oldestAt
              ? `${queue.owed.count} refunds; oldest waiting ${formatAge(queue.owed.oldestAt)}`
              : `${queue.owed.count} refunds waiting`
          }
        />
        <Stat
          label="In USDC"
          value={formatAmount(usd.tokenAmount)}
          note={`${usd.count} paid back in dollars`}
        />
        <Stat
          label="In EURC"
          value={formatAmount(eur.tokenAmount)}
          note={
            eur.unpricedCount > 0
              ? `${eur.count} in euros; ${eur.unpricedCount} not priced`
              : `${eur.count} paid back in euros`
          }
        />
        <Stat
          label="Needs an operator"
          value={String(queue.failed.count)}
          note={
            queue.failed.count > 0
              ? `${formatWalletUsd(queue.failed.usd)} stopped retrying`
              : "nothing stopped retrying"
          }
        />
      </div>

      {note && <p className="text-xs text-gray-500">{note}</p>}
      {queue.truncated && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          More refunds are waiting than this list shows — the oldest{" "}
          {queue.items.length} are listed and the totals cover only those.
        </p>
      )}

      {queue.items.length === 0 ? (
        <Empty>No refunds are waiting. Every refund recorded has been paid.</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2 pr-3">Waiting</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Cardholder · last error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {queue.items.map((item) => (
              <RefundQueueRow key={item.uniqueOperationId} item={item} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RefundQueueRow({ item }: { item: RefundQueueItem }) {
  return (
    <tr className="align-top">
      <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
        <div>{formatAge(item.createdAt)}</div>
        <div className="text-[11px] text-gray-400">
          {item.createdAt ? formatDateTime(item.createdAt) : "—"}
        </div>
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <div className="font-medium text-gray-900">
          {item.tokenAmount != null
            ? `${formatAmount(item.tokenAmount)} ${item.symbol}`
            : `— ${item.symbol}`}
        </div>
        <div className="text-[11px] text-gray-500">
          {formatWalletUsd(item.amountUsd)}
          {item.reason ? ` · ${item.reason}` : ""}
        </div>
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-xs">
        <span
          className={`rounded px-1.5 py-0.5 font-medium ${
            item.autoPayable
              ? "bg-amber-100 text-amber-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {item.autoPayable ? item.status : `${item.status} · operator`}
        </span>
        <div className="mt-1 text-[11px] text-gray-500">
          {item.attempts} attempt{item.attempts === 1 ? "" : "s"}
          {item.nextAttemptAt && item.autoPayable
            ? ` · next ${formatDateTime(item.nextAttemptAt)}`
            : ""}
        </div>
      </td>
      <td className="py-2 text-xs">
        {item.userId ? (
          <a
            href={`/users/${item.userId}`}
            className="font-mono text-indigo-600 hover:underline"
          >
            {item.userId}
          </a>
        ) : (
          <span className="text-gray-400">no user on record</span>
        )}
        {item.lastError && (
          <p className="mt-1 break-words text-gray-700">
            {item.attributedToBalance && (
              <span className="mr-1 inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
                <AlertCircle className="h-3 w-3" /> out of funds
              </span>
            )}
            {item.lastError}
          </p>
        )}
        <p className="mt-1 font-mono text-[11px] text-gray-400">
          {item.uniqueOperationId}
        </p>
      </td>
    </tr>
  );
}

const Loading = () => (
  <div className="flex h-40 items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
  </div>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded border border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-600">
    {children}
  </p>
);
