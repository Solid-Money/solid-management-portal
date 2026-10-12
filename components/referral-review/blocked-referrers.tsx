"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  useBlockedReferrers,
  useBlockReferrer,
  useUnblockReferrer,
} from "@/hooks/use-referral-review";
import { BLOCK_MODES, referralStatus } from "@/lib/referral";
import { formatDateTime } from "@/lib/utils";
import type {
  ReferralBlockedReferrerRow,
  ReferralBlockMode,
} from "@/types/referral-review";
import type { ReferralRewardStatus } from "@/types";
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

const MODES = Object.keys(BLOCK_MODES) as ReferralBlockMode[];

/**
 * Referrers blocked from referral rewards, and how: every current and future
 * reward of theirs held, voided, or paid to the friend only.
 */
export function BlockedReferrers() {
  const { data, isLoading } = useBlockedReferrers();
  const [editing, setEditing] = useState<{
    referrer: string;
    mode: ReferralBlockMode;
  } | null>(null);
  const [unblocking, setUnblocking] =
    useState<ReferralBlockedReferrerRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-3xl text-sm text-gray-500">
          A block applies to every reward the referrer has not been paid yet,
          and to every friend of theirs who qualifies later. Rewards an admin
          already decided — approved, or approved to pay the friend only —
          stay decided. Payouts already in flight are never stopped.
        </p>
        <Button
          onClick={() => setEditing({ referrer: "", mode: "hold" })}
          className="cursor-pointer"
        >
          <Ban className="h-4 w-4" />
          Block a referrer
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Referrer</th>
              <th className="px-3 py-2 text-left font-medium">Mode</th>
              <th className="px-3 py-2 text-left font-medium">Their rewards</th>
              <th className="px-3 py-2 text-left font-medium">Why</th>
              <th className="px-3 py-2 text-left font-medium">Blocked</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-500">
                  No referrer is blocked.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.referrerId} className="align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/users/${row.referrerId}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {row.username || row.referrerId}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={BLOCK_MODES[row.mode].variant}>
                      {BLOCK_MODES[row.mode].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(row.rewards).map(([status, count]) => (
                        <Badge
                          key={status}
                          variant={
                            referralStatus(status as ReferralRewardStatus)
                              .variant
                          }
                        >
                          {count}{" "}
                          {referralStatus(
                            status as ReferralRewardStatus,
                          ).label.toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-gray-700">
                    {row.reason}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                    {formatDateTime(row.blockedAt)}
                    <p className="text-[11px]">by {row.blockedBy}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setEditing({
                          referrer: row.username || row.referrerId,
                          mode: row.mode,
                        })
                      }
                      className="mr-1 cursor-pointer"
                    >
                      Change mode
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setUnblocking(row)}
                      className="cursor-pointer"
                    >
                      Unblock
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <BlockDialog
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {unblocking && (
        <UnblockDialog
          row={unblocking}
          onClose={() => setUnblocking(null)}
        />
      )}
    </div>
  );
}

function BlockDialog({
  initial,
  onClose,
}: {
  initial: { referrer: string; mode: ReferralBlockMode };
  onClose: () => void;
}) {
  const [referrer, setReferrer] = useState(initial.referrer);
  const [mode, setMode] = useState<ReferralBlockMode>(initial.mode);
  const [reason, setReason] = useState("");
  const block = useBlockReferrer();
  const isChange = !!initial.referrer;

  const submit = () =>
    block.mutate(
      { referrer: referrer.trim(), mode, reason: reason.trim() },
      {
        onSuccess: (result) => {
          const { held, voided, withheld, kept, skipped } = result.applied;
          const parts = [
            held && `${held} held`,
            voided && `${voided} voided`,
            withheld && `${withheld} referrer shares withheld`,
            kept && `${kept} already decided, kept`,
            skipped && `${skipped} skipped (payout in flight)`,
          ].filter(Boolean);
          toast.success(
            `${result.username} blocked (${BLOCK_MODES[result.mode].label})${
              parts.length ? `: ${parts.join(", ")}` : ""
            }`,
          );
          onClose();
        },
      },
    );

  return (
    <Dialog open onOpenChange={(open) => (!open && !block.isPending ? onClose() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isChange ? `Change how ${initial.referrer} is blocked` : "Block a referrer"}
          </DialogTitle>
          <DialogDescription>
            Applies to their unpaid rewards now, and to friends who qualify
            later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isChange && (
            <div className="space-y-1.5">
              <Label htmlFor="block-referrer">Referrer</Label>
              <Input
                id="block-referrer"
                value={referrer}
                onChange={(event) => setReferrer(event.target.value)}
                placeholder="username or user id"
              />
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Mode</legend>
            {MODES.map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${
                  mode === value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="block-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-gray-900">
                    {BLOCK_MODES[value].label}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {BLOCK_MODES[value].description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Reason</Label>
            <Textarea
              id="block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What was found — it goes on the referrer's audit trail"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={block.isPending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant={mode === "void" ? "destructive" : "default"}
            onClick={submit}
            disabled={!referrer.trim() || !reason.trim() || block.isPending}
            className="cursor-pointer"
          >
            {block.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isChange ? "Save" : "Block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnblockDialog({
  row,
  onClose,
}: {
  row: ReferralBlockedReferrerRow;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const unblock = useUnblockReferrer();
  const name = row.username || row.referrerId;

  const submit = () =>
    unblock.mutate(
      { referrer: row.referrerId, reason: reason.trim() },
      {
        onSuccess: (result) => {
          toast.success(
            `${name} unblocked: ${result.released} released from review, ${result.restored} referrer shares restored`,
          );
          onClose();
        },
      },
    );

  return (
    <Dialog open onOpenChange={(open) => (!open && !unblock.isPending ? onClose() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Unblock {name}</DialogTitle>
          <DialogDescription>
            Rewards held only because of the block go back to Qualified, and
            referrer shares it withheld are restored. Rewards it voided stay
            voided — approve them in the review queue (Reversed) if they should
            pay.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="unblock-reason">Reason</Label>
          <Textarea
            id="unblock-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={unblock.isPending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!reason.trim() || unblock.isPending}
            className="cursor-pointer"
          >
            {unblock.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Unblock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
