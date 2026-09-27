"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  formatAge,
  formatRunway,
  formatWalletUsd,
  getExternalAccounts,
  recordExternalBalance,
} from "@/lib/wallets";
import { ExternalAccountStatus } from "@/types";

/**
 * Money held with a third party that pays for user gas.
 *
 * Pimlico ran dry on 24 September and this page had nothing to say — not
 * because the reading was wrong but because nothing here knew the account
 * existed. Its balance cannot be fetched: the public API exposes sponsorship
 * policies only, and their own docs state there is no low-balance alerting. So
 * the row shows the last figure a person recorded, how old it is, and a link
 * to go and check. A row that admits it cannot read itself is worth more than
 * no row, because it is the only thing that will prompt anyone to look.
 */
export default function ExternalAccounts() {
  const { data, isLoading } = useQuery({
    queryKey: ["external-accounts"],
    queryFn: getExternalAccounts,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return <p className="py-6 text-sm text-gray-500">Loading…</p>;
  }

  if (!data || data.accounts.length === 0) return null;

  return (
    <div className="space-y-3">
      {data.accounts.map((account) => (
        <AccountCard key={account.name} account={account} />
      ))}
    </div>
  );
}

function AccountCard({ account }: { account: ExternalAccountStatus }) {
  const queryClient = useQueryClient();
  const [recording, setRecording] = useState(false);

  const unknown = !account.latest;
  const alarming = unknown || account.latest?.stale || account.plan?.belowFloor;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white ${
        alarming ? "border-yellow-300" : "border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{account.name}</h3>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {account.role}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {account.funds}
          </p>
        </div>

        <div className="text-right">
          <div className="text-xl font-semibold text-gray-900">
            {unknown
              ? "unknown"
              : `${formatWalletUsd(account.latest?.balance)}`}
          </div>
          <div className="text-xs text-gray-500">
            {unknown
              ? "never recorded"
              : `recorded ${formatAge(account.latest?.recordedAt)} by ${
                  account.latest?.recordedBy
                }`}
          </div>
        </div>
      </div>

      {alarming && (
        <div className="flex items-start gap-1.5 border-t border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {unknown
              ? "Nobody has recorded this balance, so the page cannot tell you whether it is about to run out."
              : account.latest?.stale
              ? `This reading is ${account.latest.ageHours} hours old. It went from funded to empty inside a day on 24 September, so anything this old cannot rule that out.`
              : `Below ${account.plan?.floorDays} days of cover at the measured draw.`}{" "}
            {account.impactWhenEmpty}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 px-4 py-3 sm:grid-cols-4">
        <Stat
          label="Draw / day"
          value={
            account.drawPerDay != null
              ? formatWalletUsd(account.drawPerDay)
              : "—"
          }
          note={
            account.drawPerDay != null
              ? "measured between recordings"
              : "needs two recordings"
          }
        />
        <Stat
          label="Runway"
          value={formatRunway(account.daysOfRunway)}
          note={
            account.daysOfRunway != null
              ? "at the measured draw"
              : "no draw measured"
          }
        />
        <Stat
          label="Top up to"
          value={
            account.plan ? formatWalletUsd(account.plan.targetAmount) : "—"
          }
          note={
            account.plan
              ? `${account.plan.targetDays} days of cover`
              : "no target without a draw"
          }
        />
        <Stat
          label="Send now"
          value={
            account.plan?.refillAmount
              ? formatWalletUsd(account.plan.refillAmount)
              : account.plan
              ? "nothing"
              : "—"
          }
          note={account.plan?.belowFloor ? "below floor" : "covered"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2">
        <p className="max-w-2xl text-xs text-gray-500">{account.readNote}</p>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href={account.dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
          >
            Open {account.provider} dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => setRecording((open) => !open)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            {recording ? "Cancel" : "Record balance"}
          </button>
        </div>
      </div>

      {recording && (
        <RecordForm
          account={account}
          onDone={async () => {
            setRecording(false);
            await queryClient.invalidateQueries({
              queryKey: ["external-accounts"],
            });
          }}
        />
      )}

      {account.history.length > 1 && (
        <details className="border-t border-gray-100 px-4 py-2">
          <summary className="cursor-pointer text-xs text-gray-500">
            {account.history.length} recordings
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {[...account.history].reverse().map((row, index) => (
              <li key={`${row.recordedAt}:${index}`}>
                {formatWalletUsd(row.balance)} · {formatAge(row.recordedAt)} ·{" "}
                {row.recordedBy}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RecordForm({
  account,
  onDone,
}: {
  account: ExternalAccountStatus;
  onDone: () => void;
}) {
  const [balance, setBalance] = useState("");
  const [toppedUpBy, setToppedUpBy] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      recordExternalBalance({
        account: account.name,
        balance: Number(balance),
        ...(toppedUpBy ? { toppedUpBy: Number(toppedUpBy) } : {}),
        ...(note ? { note } : {}),
      }),
    onSuccess: onDone,
  });

  const valid = balance !== "" && Number.isFinite(Number(balance));

  return (
    <form
      className="space-y-2 border-t border-gray-100 bg-indigo-50/40 px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) mutation.mutate();
      }}
    >
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-gray-700">
          <span className="block">Balance now ({account.currency})</span>
          <input
            type="number"
            step="any"
            min="0"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            className="mt-0.5 w-40 rounded border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="0.00"
          />
        </label>
        <label className="text-xs text-gray-700">
          {/* Without this, a reading taken after a refill reads as the account
              having earned money, and the draw between the two is lost. */}
          <span className="block">Topped up since last reading</span>
          <input
            type="number"
            step="any"
            min="0"
            value={toppedUpBy}
            onChange={(event) => setToppedUpBy(event.target.value)}
            className="mt-0.5 w-40 rounded border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="optional"
          />
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-gray-700">
          <span className="block">Note</span>
          <input
            type="text"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-0.5 w-full rounded border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="optional"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!valid || mutation.isPending}
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save reading"}
        </button>
        {mutation.isError && (
          <span className="text-xs text-red-700">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Could not save"}
          </span>
        )}
      </div>
    </form>
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
    <div>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-0.5 font-semibold text-gray-900">{value}</div>
      {note && <div className="text-xs text-gray-400">{note}</div>}
    </div>
  );
}
