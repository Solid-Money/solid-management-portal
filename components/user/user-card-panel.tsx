"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, CreditCard, Loader2, Snowflake } from "lucide-react";

import { getCardAuditHistory } from "@/lib/api";
import {
  CardAuditAction,
  CardAuditEntry,
  CardSpendBlock,
  UserCardOverview,
  WirexSpendContext,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyableValue } from "@/components/ui/copy-button";
import FreezeCardDialog from "@/components/user/freeze-card-dialog";
import IssueCardDialog from "@/components/user/issue-card-dialog";
import UnblockCardSpendDialog from "@/components/user/unblock-card-spend-dialog";

const PROVIDER_LABELS: Record<string, string> = {
  rain: "Rain",
  wirex: "Wirex",
  bridge: "Bridge.xyz (legacy)",
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Money, or an em dash when the figure is missing.
 *
 * Deliberately tolerant of a number that is not there. This panel renders
 * whatever accounts-service sends, and a field that goes away in a backend
 * change must show as "not reported" — not throw inside render and take the
 * whole user page down with it, which is exactly what a bare `.toLocaleString`
 * on a renamed field did here.
 */
const usd = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? `$${value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "—";

/** A spend cap. `null` means the Safe set no cap of its own, which is not $0. */
const cap = (value: number | null | undefined) =>
  value === null ? "No cap" : usd(value);

/**
 * The binding constraint on this card, named outright.
 *
 * Ordered by which one actually decides the next tap: the backend block is
 * checked before the chain is read, a module-wide pause makes the user's own
 * balance irrelevant, a revoked module is not a funding problem, and an
 * exhausted cap is not an empty Safe. Support needs the first one that
 * applies, because each sends them somewhere different.
 */
function describeBlocker(
  spend: WirexSpendContext,
  block?: CardSpendBlock,
): string | null {
  if (block?.blocked) {
    return "Card spending is blocked by the backend. Every tap is declined, however healthy the Safe looks.";
  }
  if (spend.modulePaused) {
    return "Card spending is paused for everyone. This is a module-wide pause, not something about this user.";
  }
  if (spend.safePaused) {
    return "This user's Safe is paused — usually arrears or a fraud hold. Nothing will authorize until it is lifted.";
  }
  if (!spend.registeredOnChain) {
    return "Never registered for card spending. They need to finish card setup in the app.";
  }
  if (!spend.moduleEnabled) {
    return "Module consent was revoked. They need to re-enable card spending in the app — registering again will not fix it.";
  }
  if (spend.limitRemainingUsd <= 0) {
    return "Spending cap reached. Nothing more authorizes until the daily or monthly window rolls over.";
  }
  if (spend.spendableUsd > 0) return null;
  if (spend.heldUsd > 0) {
    return "Everything is committed to charges Wirex has not settled yet.";
  }
  return "Nothing spendable in the Safe. They need to deposit.";
}

/**
 * Why a Wirex card can spend what it can — and, more often, why it cannot.
 *
 * A Wirex card holds no balance: it spends the cardholder's own assets where
 * they sit, through the cash module on their Safe. So "Card balance: $0.00" on
 * a Wirex row is ambiguous in a way it never is for Rain, and the causes need
 * opposite answers from support. Spelling out the inputs turns a conversation
 * that starts with "the balance looks wrong" into one that starts with "their
 * daily cap is spent".
 */
function WirexSpendBreakdown({ card }: { card: UserCardOverview }) {
  const spend = card.wirexSpend;
  if (card.provider !== "wirex") return null;

  if (!spend) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        Could not read this cardholder&apos;s on-chain spend state. The balance
        above may be stale — retry before drawing conclusions from it.
      </div>
    );
  }

  const blocker = describeBlocker(spend, card.spendBlock);
  const blocked = card.spendBlock?.blocked === true;
  const paused = spend.modulePaused || spend.safePaused;

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase text-gray-500">
          Wirex spending power
        </h4>
        <Badge
          variant={
            blocked || paused
              ? "danger"
              : spend.registered
                ? "success"
                : "warning"
          }
        >
          {blocked
            ? "Blocked"
            : paused
              ? "Paused"
              : spend.registered
                ? "Registered"
                : "Not registered"}
        </Badge>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-gray-500">Spendable now</dt>
          <dd className="mt-0.5 font-medium text-gray-900">
            {usd(spend.spendableUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Cap left</dt>
          <dd className="mt-0.5 font-medium text-gray-900">
            {usd(spend.limitRemainingUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">On hold</dt>
          <dd className="mt-0.5 font-medium text-gray-900">
            {usd(spend.heldUsd)}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] text-gray-500">
        Caps: {cap(spend.dailyLimitUsd)} daily · {cap(spend.monthlyLimitUsd)}{" "}
        monthly
      </p>

      <p className="text-xs text-gray-600">
        {blocker ??
          "This card spends the user's own assets directly — there is no balance to top up."}
      </p>
    </div>
  );
}

/**
 * The backend's card-spend block, and the way to lift it.
 *
 * Shown on its own, not only inside the spending-power breakdown. The block
 * is not chain state, so it has to be visible even when the chain read failed
 * and that panel is empty. A closure block gets no button: recovering the
 * account is what lifts it, and lifting it here would let a closed account
 * spend.
 */
function SpendBlockNotice({
  userId,
  username,
  block,
}: {
  userId: string;
  username: string;
  block?: CardSpendBlock;
}) {
  if (!block?.blocked) return null;

  const { safeAddress } = block;

  return (
    <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 font-medium">
            <Ban className="h-3.5 w-3.5" />
            {block.accountClosure
              ? "Card spending blocked: account closed"
              : "Card spending blocked: arrears"}
          </p>
          <p>
            {block.accountClosure
              ? "Closing the account set this block. Recovering the account lifts it. It cannot be unblocked here."
              : "A sweep failed after Wirex settled, so we never collected the spend. Every new tap is declined until this is lifted."}
          </p>
        </div>
        {!block.accountClosure && safeAddress && (
          <UnblockCardSpendDialog
            userId={userId}
            username={username}
            block={{ ...block, safeAddress }}
          />
        )}
      </div>
      {block.reason && (
        <p className="break-words font-mono text-[11px] text-red-700">
          {block.reason}
        </p>
      )}
    </div>
  );
}

/** Who froze the card, and whether the cardholder can undo it themselves. */
function FreezeExplanation({ card }: { card: UserCardOverview }) {
  if (!card.frozen) return null;

  const byCustomer = card.freezeInitiator === "customer";

  return (
    <div
      className={`rounded-md border p-3 text-xs ${
        byCustomer
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <span className="font-medium">
        {byCustomer
          ? "Frozen by the cardholder."
          : "Frozen by an admin or by the provider."}
      </span>{" "}
      {byCustomer
        ? "They can unfreeze it themselves in the app."
        : "The cardholder cannot unfreeze this from the app — it has to be lifted here."}
    </div>
  );
}

/** How each admin action reads in the history, and how loudly. */
const ACTION_LABELS: Record<
  CardAuditAction,
  { label: string; variant: "warning" | "success" | "info" | "danger" }
> = {
  card_frozen: { label: "Frozen", variant: "warning" },
  card_unfrozen: { label: "Unfrozen", variant: "success" },
  card_issued: { label: "New card issued", variant: "info" },
  card_canceled: { label: "Card canceled", variant: "danger" },
};

/** The card ids an audit row refers to, so a replacement can be traced. */
function auditCardIds(entry: CardAuditEntry): string | null {
  const metadata = entry.metadata ?? {};
  const cardId = typeof metadata.cardId === "string" ? metadata.cardId : null;
  const previousCardId =
    typeof metadata.previousCardId === "string"
      ? metadata.previousCardId
      : null;

  if (entry.action === "card_issued" && previousCardId) {
    return `${previousCardId.slice(0, 8)}… → ${cardId ? `${cardId.slice(0, 8)}…` : "new card"}`;
  }
  return cardId ? `${cardId.slice(0, 8)}…` : null;
}

/**
 * Every admin action taken on this card, newest first.
 *
 * Deliberately wider than the freezes it started as: a cancel followed by an
 * issue is one replacement, and either half on its own tells the wrong story
 * about why this cardholder is on their third card this year.
 */
function CardAuditHistory({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ data: CardAuditEntry[] }>({
    queryKey: ["user-card-audit-history", userId],
    queryFn: async () => (await getCardAuditHistory(userId)).data,
  });

  const entries = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No admin has frozen, canceled or issued a card for this user.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => {
        const action = ACTION_LABELS[entry.action];
        const cardIds = auditCardIds(entry);

        return (
          <li
            key={entry._id}
            className="flex flex-col gap-1 border-l-2 border-gray-200 pl-3 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={!entry.success ? "danger" : action.variant}>
                {action.label}
                {!entry.success && " (failed)"}
              </Badge>
              <span className="font-medium text-gray-900">
                {entry.adminUsername}
              </span>
              <span className="text-gray-500">
                {formatDateTime(entry.createdAt)}
              </span>
            </div>
            {cardIds && (
              <span className="font-mono text-[11px] text-gray-500">
                {cardIds}
              </span>
            )}
            {entry.reason && (
              <span className="text-gray-600">“{entry.reason}”</span>
            )}
            {entry.error && <span className="text-red-600">{entry.error}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The user's card: which issuer holds it, what state it is in, and the audit
 * trail of every admin freeze. The freeze control lives here rather than in the
 * page header so the action sits next to the state it changes.
 */
export default function UserCardPanel({
  userId,
  username,
  card,
  isLoading,
}: {
  userId: string;
  username: string;
  card?: UserCardOverview;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-gray-400" />
          Card
        </CardTitle>
        {/* Both actions sit here, next to the state they change. Issuing is
            offered even to a cardholder with no card: the self-serve flow
            leaves a handful of approved applicants without one, and this is
            the only way they get served. */}
        <CardAction>
          <div className="flex flex-wrap items-center gap-2">
            {card?.hasCard && (
              <FreezeCardDialog
                userId={userId}
                username={username}
                card={card}
              />
            )}
            {!isLoading && (
              <IssueCardDialog
                userId={userId}
                username={username}
                card={card}
              />
            )}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : !card?.hasCard ? (
          <p className="text-sm text-gray-500">
            This user has no card. Issue one above if they should have it.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Provider
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {PROVIDER_LABELS[card.provider ?? ""] ?? card.provider ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      card.frozen
                        ? "warning"
                        : card.status === "active"
                          ? "success"
                          : "muted"
                    }
                  >
                    {card.frozen ? (
                      <>
                        <Snowflake className="h-3 w-3" /> Frozen
                      </>
                    ) : (
                      (card.status ?? "unknown")
                    )}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  {/* A Wirex card has no balance of its own — the number is
                      what it can reach right now, which is a different claim. */}
                  {card.provider === "wirex" ? "Spendable now" : "Card balance"}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {usd(card.balanceUsd)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Ordered
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDateTime(card.createdAt)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Card ID
                </dt>
                <dd className="mt-1">
                  <CopyableValue value={card.cardId} label="Card ID" />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Issuer customer ID
                </dt>
                <dd className="mt-1">
                  <CopyableValue
                    value={card.providerCustomerId}
                    label="Customer ID"
                  />
                </dd>
              </div>
            </dl>

            <SpendBlockNotice
              userId={userId}
              username={username}
              block={card.spendBlock}
            />

            <WirexSpendBreakdown card={card} />

            <FreezeExplanation card={card} />
          </>
        )}

        {/* Outside the has-card branch: a card that was canceled and never
            replaced leaves the user with none, and that history is exactly
            what explains the empty panel above it. */}
        {!isLoading && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <h4 className="text-xs font-semibold uppercase text-gray-500">
              Admin card actions
            </h4>
            <CardAuditHistory userId={userId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
