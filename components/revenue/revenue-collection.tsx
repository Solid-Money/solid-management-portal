"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { CopyableValue } from "@/components/ui/copy-button";
import {
  cn,
  formatDateTime,
  formatNumber,
  formatUsd,
  tokenFractionDigits,
} from "@/lib/utils";
import type {
  RevenueCollectionDestination,
  RevenueCollectionLine,
  VaultFeeAccountant,
  VaultFeeCollectionResponse,
} from "@/types/revenue";

/** A count of fees, or nothing when there were none. */
const fees = (count: number) =>
  count > 0 ? `${formatNumber(count, 0, 0)} fee${count === 1 ? "" : "s"}` : "";

/** Where a destination is, in one short phrase: chain, or off-chain. */
function whereLabel(destination: RevenueCollectionDestination): string {
  if (destination.kind === "offchain") return "Off-chain";
  return destination.chainName ?? "Chain varies";
}

/**
 * The one-line answer under a business-line row: where its money lands.
 *
 * Shows the largest destination by name and address, so the address sits next
 * to the number without opening anything, and says how many more there are.
 */
export function CollectionSummary({
  line,
  expanded,
  onToggle,
}: {
  line: RevenueCollectionLine;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [first, ...rest] = line.destinations;
  if (!first) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
      <span className="text-gray-400">Collected at</span>
      <span className="font-medium text-gray-700">{first.label}</span>
      {first.address ? (
        <CopyableValue
          value={first.address}
          label="Address"
          truncate
          href={first.explorerUrl ?? undefined}
        />
      ) : null}
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
        {whereLabel(first)}
      </span>
      {rest.length > 0 ? (
        <span className="text-gray-400">+{rest.length} more</span>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="ml-auto text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        {expanded ? "Hide collection" : "Collection details"}
      </button>
    </div>
  );
}

/**
 * The yield share row's one-line answer: the fees sit in the vault
 * accountants until claimed, then go to their payout address.
 */
export function VaultCollectionSummary({
  vaults,
  expanded,
  onToggle,
}: {
  vaults: VaultFeeCollectionResponse | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const accountants = vaults?.accountants ?? [];
  const payouts = [
    ...new Set(
      accountants
        .map((accountant) => accountant.payoutAddress)
        .filter((address): address is string => Boolean(address))
    ),
  ];
  const [payout] = payouts;
  const payoutAccountant = accountants.find(
    (accountant) => accountant.payoutAddress === payout
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
      <span className="text-gray-400">Accrues in</span>
      <span className="font-medium text-gray-700">
        {vaults
          ? `${accountants.length} vault accountant${accountants.length === 1 ? "" : "s"}`
          : "the vault accountants"}
      </span>
      {payout ? (
        <>
          <span className="text-gray-400">· paid out to</span>
          <CopyableValue
            value={payout}
            label="Payout address"
            truncate
            href={payoutAccountant?.payoutExplorerUrl ?? undefined}
          />
          {payouts.length > 1 ? (
            <span className="text-gray-400">+{payouts.length - 1} more</span>
          ) : null}
        </>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="ml-auto text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        {expanded ? "Hide collection" : "Claimed vs unclaimed"}
      </button>
    </div>
  );
}

/**
 * Every place one row's money lands, with the asset it arrived in and how much
 * was collected against how much is still owed.
 */
export function CollectionDetails({ line }: { line: RevenueCollectionLine }) {
  const showOutstanding = line.destinations.some(
    (destination) => destination.outstandingCount > 0
  );

  return (
    <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50 p-3">
      {line.note ? <p className="text-xs text-gray-600">{line.note}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="py-1 pr-4 font-medium">Collected at</th>
              <th className="py-1 pr-4 font-medium">Chain</th>
              <th className="py-1 pr-4 font-medium">Asset</th>
              <th className="py-1 pr-4 text-right font-medium">Collected</th>
              {showOutstanding ? (
                <th className="py-1 text-right font-medium">Still owed</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="align-top">
            {line.destinations.map((destination) => (
              <DestinationRow
                key={destination.key}
                destination={destination}
                showOutstanding={showOutstanding}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DestinationRow({
  destination,
  showOutstanding,
}: {
  destination: RevenueCollectionDestination;
  showOutstanding: boolean;
}) {
  return (
    <>
      <tr className="border-t border-gray-100">
        <td className="py-1.5 pr-4">
          <div className="font-medium text-gray-800">{destination.label}</div>
          {destination.address ? (
            <CopyableValue
              value={destination.address}
              label="Address"
              truncate
              href={destination.explorerUrl ?? undefined}
            />
          ) : destination.kind === "onchain" ? (
            <span className="text-amber-700">Address not configured</span>
          ) : (
            <span className="text-gray-400">No on-chain address</span>
          )}
        </td>
        <td className="py-1.5 pr-4 text-gray-700">{whereLabel(destination)}</td>
        <td className="py-1.5 pr-4 text-gray-700">
          {destination.assets.length > 0 ? (
            <ul className="space-y-0.5">
              {destination.assets.map((asset) => (
                <li
                  key={`${asset.tokenAddress ?? ""}:${asset.symbol}`}
                  className="whitespace-nowrap"
                >
                  {asset.symbol}{" "}
                  <span className="tabular-nums text-gray-500">
                    {formatUsd(asset.collectedUsd)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-gray-900">
          {formatUsd(destination.collectedUsd)}
          <div className="text-[11px] text-gray-400">
            {fees(destination.collectedCount)}
          </div>
        </td>
        {showOutstanding ? (
          <td
            className={cn(
              "py-1.5 text-right tabular-nums",
              destination.outstandingCount > 0
                ? "text-amber-700"
                : "text-gray-400"
            )}
          >
            {destination.outstandingCount > 0
              ? formatUsd(destination.outstandingUsd)
              : "—"}
            <div className="text-[11px] text-gray-400">
              {fees(destination.outstandingCount)}
            </div>
          </td>
        ) : null}
      </tr>
      {destination.note ? (
        <tr>
          <td
            colSpan={showOutstanding ? 5 : 4}
            className="pb-2 pr-4 text-[11px] leading-snug text-gray-500"
          >
            {destination.note}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** A token amount with its symbol, at the token's own precision. */
function tokenAmount(value: string | null, symbol: string): string {
  if (value === null) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${symbol}`;
  return `${formatNumber(amount, tokenFractionDigits(symbol))} ${symbol}`;
}

/** USD beside a token amount, unless the asset is a dollar already. */
function usdHint(usd: number | null, price: number | null): string | null {
  if (usd === null || price === null || price === 1) return null;
  return `≈ ${formatUsd(usd)}`;
}

/**
 * The vault yield share row's collection: each accountant's payout address,
 * what it has paid out and what it still holds.
 */
export function VaultFeeAccountants({
  vaults,
}: {
  vaults: VaultFeeCollectionResponse | null;
}) {
  if (!vaults) {
    return (
      <p className="rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
        The vault accountants could not be read just now. The rest of the page
        is unaffected; try again in a minute.
      </p>
    );
  }

  const claimedUsd = sum(vaults.accountants.map((a) => a.claimedUsd));
  const unclaimedUsd = sum(vaults.accountants.map((a) => a.unclaimedUsd));

  return (
    <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs text-gray-600">
        Performance fees accrue in each vault&apos;s accountant contract until{" "}
        <code className="text-[11px]">claimFees()</code> pays them to its payout
        address. All time, read from the chain at{" "}
        {formatDateTime(vaults.readAt, {
          hour: "2-digit",
          minute: "2-digit",
        })}
        . The yield share figure above is an estimate from TVL and rate moves,
        so it will not equal claimed plus unclaimed.
      </p>
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="text-gray-500">
          Claimed{" "}
          <span className="font-semibold tabular-nums text-gray-900">
            {claimedUsd.value === null ? "—" : formatUsd(claimedUsd.value)}
          </span>
        </span>
        <span className="text-gray-500">
          Still unclaimed{" "}
          <span className="font-semibold tabular-nums text-amber-700">
            {unclaimedUsd.value === null ? "—" : formatUsd(unclaimedUsd.value)}
          </span>
        </span>
        {claimedUsd.partial || unclaimedUsd.partial ? (
          <span className="text-gray-400">
            Totals leave out what could not be read or priced.
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="py-1 pr-4 font-medium">Vault</th>
              <th className="py-1 pr-4 font-medium">Accountant</th>
              <th className="py-1 pr-4 font-medium">Paid out to</th>
              <th className="py-1 pr-4 text-right font-medium">Claimed</th>
              <th className="py-1 pr-4 text-right font-medium">Unclaimed</th>
              <th className="py-1 font-medium">Last claim</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {vaults.accountants.map((accountant) => (
              <AccountantRow
                key={`${accountant.vault}:${accountant.chainId}`}
                accountant={accountant}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountantRow({ accountant }: { accountant: VaultFeeAccountant }) {
  const symbol = accountant.asset.symbol;
  const claimedHint = usdHint(accountant.claimedUsd, accountant.usdPrice);
  const unclaimedHint = usdHint(accountant.unclaimedUsd, accountant.usdPrice);

  return (
    <>
      <tr className="border-t border-gray-100">
        <td className="py-1.5 pr-4">
          <div className="font-medium text-gray-800">{accountant.vault}</div>
          <div className="text-gray-500">
            {accountant.chainName ?? `Chain ${accountant.chainId}`} · {symbol}
          </div>
        </td>
        <td className="py-1.5 pr-4">
          <CopyableValue
            value={accountant.accountant}
            label="Accountant"
            truncate
            href={accountant.accountantExplorerUrl ?? undefined}
          />
        </td>
        <td className="py-1.5 pr-4">
          <CopyableValue
            value={accountant.payoutAddress}
            label="Payout address"
            truncate
            href={accountant.payoutExplorerUrl ?? undefined}
          />
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-gray-900">
          {tokenAmount(accountant.claimed, symbol)}
          <div className="text-[11px] text-gray-400">
            {[
              claimedHint,
              accountant.claimCount !== null && accountant.claimCount > 0
                ? `${accountant.claimCount} claim${accountant.claimCount === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-amber-700">
          {tokenAmount(accountant.unclaimed, symbol)}
          {unclaimedHint ? (
            <div className="text-[11px] text-gray-400">{unclaimedHint}</div>
          ) : null}
        </td>
        <td className="py-1.5 text-gray-600">
          {accountant.lastClaimTxHash ? (
            <a
              href={accountant.lastClaimExplorerUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {accountant.lastClaimAt
                ? formatDateTime(accountant.lastClaimAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "View"}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : accountant.claimCount === 0 ? (
            <span className="text-gray-400">Never claimed</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
      </tr>
      {accountant.errors?.length ? (
        <tr>
          <td colSpan={6} className="pb-2 text-[11px] text-amber-700">
            <span className="inline-flex items-start gap-1">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
              {accountant.errors.join(" ")}
            </span>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** A total over values some of which may be unknown. */
function sum(values: Array<number | null>): {
  value: number | null;
  partial: boolean;
} {
  const known = values.filter((value): value is number => value !== null);
  return {
    value: known.length > 0 ? known.reduce((a, b) => a + b, 0) : null,
    partial: known.length < values.length,
  };
}
