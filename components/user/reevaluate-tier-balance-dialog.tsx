"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  describeApiError,
  getTierBalanceReevaluationPreview,
  reevaluateTierBalance,
} from "@/lib/api";
import {
  TIER_BALANCE_TRACK_STATUS,
  tierBalanceUsd,
} from "@/lib/tier-balance";
import { cn, formatDateTime } from "@/lib/utils";
import type {
  TierBalanceReevaluationPreview,
  TierBalanceRouteDto,
  TierBalanceTrackDto,
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
import {
  BreakdownTables,
  TierBalanceTierBadge,
  trackDate,
} from "@/components/user/tier-balance-parts";

/**
 * Support's answer to "I've held enough in Earn and I'm still not Prime".
 *
 * Reads the user's qualifying Earn balance fresh from the chain and shows the
 * route before and after applying the rules to it — Preview first, from the
 * server, and only then Confirm, with a required reason that lands on the
 * user's audit trail.
 */
export default function ReevaluateTierBalanceDialog({
  userId,
}: {
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<TierBalanceReevaluationPreview | null>(
    null,
  );
  const queryClient = useQueryClient();

  const preview = useQuery({
    queryKey: ["tier-balance-reevaluation-preview", userId],
    queryFn: async () =>
      (await getTierBalanceReevaluationPreview(userId)).data.data,
    enabled: open && !result,
    // Read fresh each time the dialog opens: it answers "what is on chain now".
    staleTime: 0,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (await reevaluateTierBalance(userId, reason.trim())).data.data,
    onSuccess: (data) => {
      toast.success(
        data.after.grantsTier !== data.before.grantsTier
          ? `The route now grants ${data.after.grantsTier}`
          : `The route still grants ${data.after.grantsTier}`,
      );
      setResult(data);
      setReason("");
      void queryClient.invalidateQueries({
        queryKey: ["user-tier-balance", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-tier-membership", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", userId],
      });
    },
    // The API layer toasts the server's reason; the dialog stays open to retry.
  });

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setResult(null);
  };

  // Held while the preview is read — first time and every reopening — so the
  // confirm is never pressed on a cached reading of a balance that has moved.
  const previewLoading = preview.isPending || preview.isFetching;
  const canConfirm =
    !mutation.isPending &&
    !previewLoading &&
    preview.isSuccess &&
    reason.trim().length > 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Re-evaluate
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          {result ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Re-evaluated
                </DialogTitle>
                <DialogDescription>
                  Applied to a fresh reading taken{" "}
                  {formatDateTime(result.measured.measuredAt)}. Recorded on the
                  user&apos;s audit trail; the app shows it the next time it
                  loads.
                </DialogDescription>
              </DialogHeader>
              <ReevaluationDetails data={result} />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={close}
                  className="cursor-pointer"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Re-evaluate the Hold in Earn route</DialogTitle>
                <DialogDescription>
                  Reads this user&apos;s qualifying Earn balance fresh from the
                  chain and applies the route&apos;s rules to it now. Below is
                  what the server says would change; nothing is applied until
                  you confirm.
                </DialogDescription>
              </DialogHeader>

              {previewLoading ? (
                <p className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Reading the balance from the chain…
                </p>
              ) : preview.isError ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  The preview could not be read, so nothing can be confirmed:{" "}
                  {describeApiError(preview.error)}
                </p>
              ) : preview.data ? (
                <ReevaluationDetails data={preview.data} />
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="reevaluate-tier-balance-reason">Reason</Label>
                <Textarea
                  id="reevaluate-tier-balance-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Holds enough in Earn but shown Core — support chat #1234"
                  disabled={mutation.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  Required. Recorded on the user&apos;s audit trail with your
                  name.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={close}
                  disabled={mutation.isPending}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                {preview.isError && (
                  <Button
                    variant="outline"
                    onClick={() => void preview.refetch()}
                    disabled={previewLoading}
                    className="cursor-pointer"
                  >
                    Read again
                  </Button>
                )}
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={!canConfirm}
                  className="cursor-pointer"
                >
                  {mutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Confirm re-evaluation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The fresh reading, the changes in words, and the route before and after. */
function ReevaluationDetails({ data }: { data: TierBalanceReevaluationPreview }) {
  const { measured } = data;
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Fresh reading {formatDateTime(measured.measuredAt)}:{" "}
            <span className="font-semibold text-gray-900">
              {tierBalanceUsd(measured.qualifyingUsd)}
            </span>
          </span>
          <Badge variant={measured.complete ? "success" : "warning"}>
            {measured.complete ? "Complete" : "Incomplete"}
          </Badge>
        </div>
        {!measured.complete && (
          <p className="flex gap-2 text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Some balances could not be read, so this figure may be low. Check
            the before and after carefully before confirming.
          </p>
        )}
        {measured.breakdown && (
          <div className="@container">
            <BreakdownTables
              breakdown={measured.breakdown}
              rules={data.after.rules}
            />
          </div>
        )}
      </div>

      <div>
        <h5 className="mb-1 text-xs font-medium text-gray-500 uppercase">
          What changes
        </h5>
        {data.changes.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nothing: the route stays as it is.
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-xs text-gray-700">
            {data.changes.map((change, index) => (
              <li key={`${index}-${change}`}>{change}</li>
            ))}
          </ul>
        )}
      </div>

      <RouteComparison before={data.before} after={data.after} />
    </div>
  );
}

function trackText(track: TierBalanceTrackDto): string {
  const status = TIER_BALANCE_TRACK_STATUS[track.status]?.label ?? track.status;
  const date = trackDate(track);
  return [status, `at ${tierBalanceUsd(track.thresholdUsd)}`, date]
    .filter(Boolean)
    .join(" · ");
}

/** The route before and after, row by row, with what moved highlighted. */
function RouteComparison({
  before,
  after,
}: {
  before: TierBalanceRouteDto;
  after: TierBalanceRouteDto;
}) {
  const rows: Array<{
    label: string;
    before: React.ReactNode;
    after: React.ReactNode;
    changed: boolean;
  }> = [
    {
      label: "Route grants",
      before: <TierBalanceTierBadge tier={before.grantsTier} />,
      after: <TierBalanceTierBadge tier={after.grantsTier} />,
      changed: before.grantsTier !== after.grantsTier,
    },
    {
      label: "Holds their current tier",
      before: before.holdsCurrentTier ? "Yes" : "No",
      after: after.holdsCurrentTier ? "Yes" : "No",
      changed: before.holdsCurrentTier !== after.holdsCurrentTier,
    },
    {
      label: "Current balance",
      before: tierBalanceUsd(before.currentUsd),
      after: tierBalanceUsd(after.currentUsd),
      changed: before.currentUsd !== after.currentUsd,
    },
    {
      label: `Lowest in ${after.lookbackDays} days`,
      before: tierBalanceUsd(before.lowestUsd),
      after: tierBalanceUsd(after.lowestUsd),
      changed: before.lowestUsd !== after.lowestUsd,
    },
    {
      label: "Ultra",
      before: trackText(before.ultra),
      after: trackText(after.ultra),
      changed: trackText(before.ultra) !== trackText(after.ultra),
    },
    {
      label: "Prime",
      before: trackText(before.prime),
      after: trackText(after.prime),
      changed: trackText(before.prime) !== trackText(after.prime),
    },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead>Before</TableHead>
          <TableHead>After</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.label}
            className={cn(row.changed && "bg-amber-50 hover:bg-amber-50")}
          >
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="whitespace-normal text-gray-500">
              {row.before}
            </TableCell>
            <TableCell className="whitespace-normal">{row.after}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
