"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getCardIssuanceContext, issueUserCard } from "@/lib/api";
import {
  CardIssuanceContext,
  CardLimitFrequency,
  CardShippingAddress,
  CardType,
  UserCardOverview,
} from "@/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The windows Rain rolls a spend cap over, in the words support uses. */
const LIMIT_FREQUENCIES: { value: CardLimitFrequency; label: string }[] = [
  { value: "per24HourPeriod", label: "Per day" },
  { value: "per7DayPeriod", label: "Per 7 days" },
  { value: "per30DayPeriod", label: "Per 30 days" },
  { value: "perYearPeriod", label: "Per year" },
  { value: "allTime", label: "All time" },
  { value: "perAuthorization", label: "Per purchase" },
];

const CARD_TYPES: { value: CardType; label: string; blurb: string }[] = [
  { value: "virtual", label: "Virtual", blurb: "Live immediately, in the app" },
  {
    value: "physical",
    label: "Physical",
    blurb: "Shipped, activated on arrival",
  },
];

/** The fields a physical order cannot go without. */
const REQUIRED_SHIPPING = [
  "line1",
  "city",
  "postalCode",
  "countryCode",
  "phoneNumber",
] as const;

/** A blank shipping form, so every field is a controlled input from the start. */
const EMPTY_SHIPPING: CardShippingAddress = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
  phoneNumber: "",
};

/** Cents as the dollars the operator reads and types. */
const centsToDollars = (cents?: number) =>
  typeof cents === "number" && Number.isFinite(cents)
    ? (cents / 100).toFixed(2)
    : "";

/** One choice in a segmented row. */
function Choice({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-indigo-500 bg-indigo-50 text-indigo-900"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** The card being replaced, spelled out so support sees what they are acting on. */
function CurrentCardSummary({ context }: { context: CardIssuanceContext }) {
  const card = context.currentCard;

  if (!card) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        This user holds no card. This will be their first one.
      </div>
    );
  }

  const canceled = card.issuerStatus === "canceled";

  return (
    <div className="space-y-1.5 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase text-gray-500">
          Card being replaced
        </h4>
        <Badge variant={canceled ? "muted" : "info"}>
          {card.issuerStatus ?? card.status ?? "unknown"}
        </Badge>
      </div>
      <p className="font-mono text-sm text-gray-900">
        •••• {card.last4 ?? "????"}
        {card.expiration ? ` · exp ${card.expiration}` : ""}
        {card.type ? ` · ${card.type}` : ""}
      </p>
      <p className="text-[11px] break-all text-gray-500">{card.cardId}</p>
    </div>
  );
}

/**
 * The form itself, mounted only once the issuer has answered.
 *
 * Split from the dialog around it so every field can seed itself from
 * `context` at mount: this form exists to be edited, and state initialised
 * from props at mount beats an effect that copies them in afterwards — the
 * copy runs a render late, and on a re-render mid-edit would take the
 * operator's typing back.
 */
function IssueCardForm({
  userId,
  username,
  context,
  onSavingChange,
  onIssued,
  onCancel,
}: {
  userId: string;
  username: string;
  context: CardIssuanceContext;
  onSavingChange: (saving: boolean) => void;
  onIssued: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const defaults = context.defaults;

  const [type, setType] = useState<CardType>(defaults.type);
  // On by default — a replacement that leaves the old card able to authorize
  // has not solved anything. The exception is a card the issuer has already
  // canceled, where there is nothing left to cancel.
  const [cancelExisting, setCancelExisting] = useState(
    context.currentCard?.issuerStatus !== "canceled"
  );
  const [displayName, setDisplayName] = useState(defaults.displayName ?? "");
  const [withLimit, setWithLimit] = useState(!!defaults.limit);
  const [limitDollars, setLimitDollars] = useState(
    centsToDollars(defaults.limit?.amount)
  );
  const [limitFrequency, setLimitFrequency] = useState<CardLimitFrequency>(
    (defaults.limit?.frequency as CardLimitFrequency) ?? "per30DayPeriod"
  );
  const [shipping, setShipping] = useState<CardShippingAddress>({
    ...EMPTY_SHIPPING,
    ...defaults.shipping,
  });
  const [reason, setReason] = useState("");

  // Dollars in, cents out — Rain's issuing API is in minor units throughout,
  // and a figure sent in dollars would be a cap a hundred times too small.
  const parsedDollars = Number(limitDollars);
  const limitCents =
    limitDollars.trim() && Number.isFinite(parsedDollars) && parsedDollars > 0
      ? Math.round(parsedDollars * 100)
      : null;

  const missingShipping =
    type === "physical"
      ? REQUIRED_SHIPPING.filter((field) => !shipping[field]?.trim())
      : [];

  const blockingProblem =
    withLimit && limitCents === null
      ? "Enter a spending limit above zero, or turn the limit off."
      : missingShipping.length > 0
        ? `A physical card needs a full shipping address — missing ${missingShipping.join(", ")}.`
        : undefined;

  const mutation = useMutation({
    mutationFn: () =>
      issueUserCard(userId, {
        type,
        cancelExisting,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(withLimit && limitCents !== null
          ? { limit: { amount: limitCents, frequency: limitFrequency } }
          : {}),
        ...(type === "physical" ? { shipping } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onMutate: () => onSavingChange(true),
    onSettled: () => onSavingChange(false),
    onSuccess: (response) => {
      const issued = response.data.data;
      toast.success(
        `${issued.type === "physical" ? "Physical" : "Virtual"} card issued for ${username}` +
          (issued.last4 ? ` (•••• ${issued.last4})` : "")
      );
      onIssued();
      // The card panel, its history and the balances all move together.
      for (const key of [
        "user-card",
        "user-card-audit-history",
        "user-balances",
        "user-card-issuance-context",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, userId] });
      }
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the operator can correct and retry.
    },
  });

  const busy = mutation.isPending;

  const setShippingField =
    (field: keyof CardShippingAddress) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setShipping((current) => ({ ...current, [field]: event.target.value }));

  return (
    <>
      <div className="space-y-4">
        <CurrentCardSummary context={context} />

        {context.currentCard && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 p-3">
            <input
              type="checkbox"
              checked={cancelExisting}
              onChange={(event) => setCancelExisting(event.target.checked)}
              disabled={busy}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-indigo-600"
            />
            <span className="text-xs text-gray-700">
              <span className="font-medium text-gray-900">
                Cancel the current card
              </span>{" "}
              — irreversible, and done before the new one is issued. If the
              cancel fails, nothing is issued.
            </span>
          </label>
        )}

        {context.currentCard &&
          !cancelExisting &&
          context.currentCard.issuerStatus !== "canceled" && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The old card will keep working and can still be charged. The app
                will show the new card instead of it. Only leave this off when
                the old card is deliberately being kept.
              </span>
            </div>
          )}

        {/* Ordering a physical card is not a replacement for a virtual one:
            physical cards are not tracked in the app, so cancelling the card
            they can actually spend on today leaves them with nothing until the
            new one arrives in the post. */}
        {type === "physical" &&
          cancelExisting &&
          context.currentCard?.type === "virtual" && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This cancels their virtual card and ships a physical one. They
                will have no card to spend on until it arrives and they activate
                it — issue a virtual replacement as well if they need one now.
              </span>
            </div>
          )}

        <div className="space-y-1.5">
          <Label className="text-xs">Card type</Label>
          <div className="flex gap-2">
            {CARD_TYPES.map((option) => (
              <Choice
                key={option.value}
                selected={type === option.value}
                disabled={busy}
                onClick={() => setType(option.value)}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-gray-500">
                  {option.blurb}
                </span>
              </Choice>
            ))}
          </div>
        </div>

        <Field label="Name on the card" htmlFor="issue-display-name">
          <Input
            id="issue-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={26}
            placeholder="Jane Doe"
            disabled={busy}
          />
          <p className="text-muted-foreground text-[11px]">
            Embossed on physical cards, ignored for virtual ones. Latin letters,
            digits, spaces, periods and hyphens only — 26 characters at most.
          </p>
        </Field>

        <div className="space-y-2 rounded-md border border-gray-200 p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={withLimit}
              onChange={(event) => setWithLimit(event.target.checked)}
              disabled={busy}
              className="h-4 w-4 cursor-pointer accent-indigo-600"
            />
            <span className="text-xs font-medium text-gray-900">
              Set a spending limit
            </span>
          </label>
          {withLimit && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (USD)" htmlFor="issue-limit-amount">
                <Input
                  id="issue-limit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={limitDollars}
                  onChange={(event) => setLimitDollars(event.target.value)}
                  disabled={busy}
                />
              </Field>
              <Field label="Window" htmlFor="issue-limit-frequency">
                <select
                  id="issue-limit-frequency"
                  value={limitFrequency}
                  onChange={(event) =>
                    setLimitFrequency(event.target.value as CardLimitFrequency)
                  }
                  disabled={busy}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {LIMIT_FREQUENCIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <p className="text-muted-foreground text-[11px]">
            Left off, the card carries whatever limit the issuer applies by
            default.
          </p>
        </div>

        {type === "physical" && (
          <div className="space-y-3 rounded-md border border-gray-200 p-3">
            <h4 className="text-xs font-semibold uppercase text-gray-500">
              Shipping address
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="ship-first">
                <Input
                  id="ship-first"
                  value={shipping.firstName ?? ""}
                  onChange={setShippingField("firstName")}
                  disabled={busy}
                />
              </Field>
              <Field label="Last name" htmlFor="ship-last">
                <Input
                  id="ship-last"
                  value={shipping.lastName ?? ""}
                  onChange={setShippingField("lastName")}
                  disabled={busy}
                />
              </Field>
              <Field
                label="Address line 1"
                htmlFor="ship-line1"
                className="col-span-2"
              >
                <Input
                  id="ship-line1"
                  value={shipping.line1}
                  onChange={setShippingField("line1")}
                  disabled={busy}
                />
              </Field>
              <Field
                label="Address line 2"
                htmlFor="ship-line2"
                className="col-span-2"
              >
                <Input
                  id="ship-line2"
                  value={shipping.line2 ?? ""}
                  onChange={setShippingField("line2")}
                  disabled={busy}
                />
              </Field>
              <Field label="City" htmlFor="ship-city">
                <Input
                  id="ship-city"
                  value={shipping.city}
                  onChange={setShippingField("city")}
                  disabled={busy}
                />
              </Field>
              <Field label="Region / State" htmlFor="ship-region">
                <Input
                  id="ship-region"
                  value={shipping.region ?? ""}
                  onChange={setShippingField("region")}
                  disabled={busy}
                />
              </Field>
              <Field label="Postal code" htmlFor="ship-postal">
                <Input
                  id="ship-postal"
                  value={shipping.postalCode}
                  onChange={setShippingField("postalCode")}
                  disabled={busy}
                />
              </Field>
              <Field label="Country code" htmlFor="ship-country">
                <Input
                  id="ship-country"
                  value={shipping.countryCode}
                  onChange={setShippingField("countryCode")}
                  maxLength={2}
                  placeholder="FR"
                  disabled={busy}
                />
              </Field>
              <Field
                label="Phone number"
                htmlFor="ship-phone"
                className="col-span-2"
              >
                <Input
                  id="ship-phone"
                  value={shipping.phoneNumber}
                  onChange={setShippingField("phoneNumber")}
                  placeholder="+33123456789"
                  disabled={busy}
                />
              </Field>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Latin characters only — the issuer rejects accents on a physical
              order. Pre-filled from their verified identity check; check it
              against what the cardholder has told you.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="issue-reason">
            Reason <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="issue-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="e.g. Cardholder reported their card details were exposed"
            disabled={busy}
          />
          <p className="text-muted-foreground text-xs">
            Recorded in the audit trail and posted to Slack with your name and
            the user&apos;s.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={busy || !!blockingProblem}
          title={blockingProblem}
          className="cursor-pointer"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {cancelExisting && context.currentCard
            ? "Cancel & issue new card"
            : "Issue card"}
        </Button>
      </DialogFooter>
    </>
  );
}

interface IssueCardDialogProps {
  userId: string;
  username: string;
  /** The panel's own view of the card, for the button's wording. */
  card?: UserCardOverview;
}

/**
 * Issue a card to a user on their behalf — in practice, replace one whose
 * details have leaked.
 *
 * ## Why this exists at all
 *
 * A cardholder cannot replace their own card: the app offers a freeze, and a
 * freeze is not enough when the number itself leaked — unfreezing brings the
 * same PAN back. Until now that meant an engineer in the issuer's dashboard,
 * which is slow and leaves nothing anyone else can read afterwards.
 *
 * ## Why the form arrives full
 *
 * The replacement should be the card they had. The dialog reads the live card,
 * the cardholder record at the issuer and their verified KYC address, and fills
 * every field from them — so support edits what actually changed instead of
 * retyping a shipping address out of a support thread, which is how a physical
 * card ends up at the wrong door.
 *
 * ## Why cancelling is the default
 *
 * The old card stops working, or the replacement has not solved anything. It
 * can be turned off deliberately — there are investigations where the old card
 * should stay live — but never by omission, and doing so is called out here
 * and on the audit row.
 */
export default function IssueCardDialog({
  userId,
  username,
  card,
}: IssueCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<{ data: CardIssuanceContext }>({
    queryKey: ["user-card-issuance-context", userId],
    queryFn: async () => (await getCardIssuanceContext(userId)).data,
    // Only asked for while the dialog is open: it calls the issuer for the live
    // card and the cardholder record, which is worth doing when support is
    // about to act and not on every page view.
    enabled: open,
    staleTime: 0,
  });

  const issuance = data?.data;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <CreditCard className="h-4 w-4" />
        {card?.hasCard ? "Issue new card" : "Issue card"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (saving) return;
          setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              Issue a new card for {username}
            </DialogTitle>
            <DialogDescription>
              Pre-filled from the card they hold and the details their issuer
              already has. Change what has actually changed — everything you do
              here is recorded against your name.
            </DialogDescription>
          </DialogHeader>

          {isLoading || !issuance ? (
            <div className="flex justify-center py-8">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              ) : (
                <p className="text-sm text-gray-500">
                  Could not read this user&apos;s card details. Close this and
                  try again.
                </p>
              )}
            </div>
          ) : !issuance.canIssue ? (
            <>
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{issuance.blockedReason}</span>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="cursor-pointer"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <IssueCardForm
              userId={userId}
              username={username}
              context={issuance}
              onSavingChange={setSaving}
              onIssued={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
