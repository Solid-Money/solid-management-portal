"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleAlert,
  Fingerprint,
  KeyRound,
  Loader2,
  Play,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import UserLink from "@/components/user-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ApprovalStatusBadge,
  DecisionDialog,
  Proposer,
  RankBadge,
  canDecide,
} from "@/components/approvals/approval-parts";
import {
  approveApproval,
  cancelApproval,
  executeApproval,
  getApproval,
  rejectApproval,
} from "@/lib/api";
import { describeRequirement } from "@/lib/admin-access";
import { formatDateTime } from "@/lib/utils";
import { APPROVAL_SUMMARY_KEY } from "@/hooks/use-admin-access";
import { useApprovalSigner } from "@/hooks/use-approval-signer";
import type { AdminApproval } from "@/types/admin-access";

const EVENT_LABEL: Record<AdminApproval["events"][number]["type"], string> = {
  requested: "Asked for approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired unapproved",
  executing: "Started running",
  executed: "Ran",
  failed: "Run failed",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-gray-900">{children}</dd>
    </div>
  );
}

/** What was asked, in full, for whoever decides it. */
function RequestBody({ body }: { body: unknown }) {
  if (body === undefined || body === null) return <span>—</span>;
  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-800">
      {JSON.stringify(body, null, 2)}
    </pre>
  );
}

/**
 * One request in full: what it does, to whom, who asked and why, who approved,
 * its history, and how its run went. Opened from the Approvals table or a link
 * (`?id=`), so a Slack ping lands straight on it.
 */
export default function ApprovalDetailSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { access } = useAuth();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const signer = useApprovalSigner();

  const { data: approval, isLoading } = useQuery<AdminApproval>({
    queryKey: ["approval", id],
    queryFn: async () => (await getApproval(id!)).data.data,
    enabled: !!id,
  });

  const refresh = (updated?: AdminApproval) => {
    if (updated) queryClient.setQueryData(["approval", updated.id], updated);
    void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    void queryClient.invalidateQueries({ queryKey: APPROVAL_SUMMARY_KEY });
  };

  const decide = useMutation({
    mutationFn: async ({
      kind,
      comment,
    }: {
      kind: "approve" | "reject";
      comment: string;
    }) =>
      (kind === "approve"
        ? await approveApproval(id!, comment, await signer.sign([id!]))
        : await rejectApproval(id!, comment)
      ).data.data,
    onSuccess: (updated) => {
      setDecision(null);
      refresh(updated);
      if (updated.status === "executed") toast.success(`Approved and ran: ${updated.label}`);
      else if (updated.status === "failed")
        toast.error(`Approved, but it failed: ${updated.execution?.error ?? "unknown error"}`);
      else if (updated.status === "rejected") toast.success("Request rejected");
      else toast.success("Approval recorded; it needs more before it runs");
    },
    onError: (error) => {
      // The API layer toasts server refusals; a passkey prompt cancelled or
      // refused in the browser never reached it.
      if (!(error as { response?: unknown }).response) {
        toast.error(error instanceof Error ? error.message : "Could not sign");
      }
    },
  });

  const withdraw = useMutation({
    mutationFn: async () => (await cancelApproval(id!)).data.data,
    onSuccess: (updated) => {
      refresh(updated);
      toast.success("Request withdrawn");
    },
  });

  const run = useMutation({
    mutationFn: async () => (await executeApproval(id!)).data.data,
    onSuccess: (updated) => {
      refresh(updated);
      if (updated.status === "executed") toast.success(`Ran: ${updated.label}`);
      else toast.error(`It failed: ${updated.execution?.error ?? updated.status}`);
    },
  });

  const mine = approval && access?.email === approval.proposerEmail;
  const involved =
    approval &&
    (mine || approval.approvals.some((entry) => entry.email === access?.email));
  const decidable = approval ? canDecide(approval, access) : false;

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-6">
            <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
            {approval?.label ?? "Approval request"}
          </SheetTitle>
          <SheetDescription>
            {approval
              ? `Needs ${describeRequirement(
                  approval.requiredApprovals,
                  approval.approverRank,
                  approval.proposerRank
                )}.`
              : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !approval ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 px-4">
            <dl className="space-y-2">
              <Field label="Status">
                <ApprovalStatusBadge status={approval.status} />
              </Field>
              <Field label="Asked by">
                <Proposer approval={approval} />
                <span className="ml-2 text-xs text-gray-500">
                  {approval.proposerEmail}
                </span>
              </Field>
              {approval.targetUserId && (
                <Field label="User">
                  <UserLink userId={approval.targetUserId} />
                </Field>
              )}
              {approval.reason && <Field label="Reason">{approval.reason}</Field>}
              <Field label="Action">
                <span className="font-mono text-xs">{approval.action}</span>
              </Field>
              <Field label="Asked">{formatDateTime(approval.createdAt)}</Field>
              {approval.status === "pending" && (
                <Field label="Expires">{formatDateTime(approval.expiresAt)}</Field>
              )}
              <Field label="Approvals">
                {approval.approvals.length} of {approval.requiredApprovals}
              </Field>
              <Field label="Request">
                <RequestBody body={approval.body} />
              </Field>
            </dl>

            {approval.execution && (
              <div
                className={
                  approval.status === "failed"
                    ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                }
              >
                <p className="flex items-center gap-1.5 font-medium">
                  {approval.status === "failed" ? (
                    <CircleAlert className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {approval.status === "failed"
                    ? "The action failed"
                    : approval.status === "executing"
                      ? "Running"
                      : "The action ran"}
                  {approval.execution.statusCode
                    ? ` (${approval.execution.statusCode})`
                    : ""}
                </p>
                {approval.execution.error && (
                  <p className="mt-1">{approval.execution.error}</p>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">History</h3>
              <ol className="space-y-2 border-l border-gray-200 pl-4">
                {approval.events.map((event, index) => (
                  <li key={index} className="text-sm">
                    <span className="font-medium text-gray-900">
                      {EVENT_LABEL[event.type] ?? event.type}
                    </span>
                    {event.email && (
                      <span className="text-gray-600"> · {event.email}</span>
                    )}
                    <span className="ml-1 text-xs text-gray-500">
                      {formatDateTime(event.at)}
                    </span>
                    {event.comment && (
                      <p className="text-xs text-gray-600">“{event.comment}”</p>
                    )}
                  </li>
                ))}
              </ol>
              {approval.approvals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-gray-600">
                  Approved by:
                  {approval.approvals.map((entry) => (
                    <span key={entry.email} className="inline-flex items-center gap-1">
                      {entry.email}
                      <RankBadge rank={entry.rank} />
                      {entry.signature && (
                        <span
                          className="inline-flex items-center gap-0.5 text-emerald-700"
                          title={`Signed with their passkey · Turnkey activity ${entry.signature.activityId}`}
                        >
                          <Fingerprint className="h-3 w-3" aria-hidden />
                          signed
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {approval && (
          <SheetFooter className="flex-row flex-wrap justify-end gap-2">
            {mine && approval.status === "pending" && (
              <Button
                variant="outline"
                onClick={() => withdraw.mutate()}
                disabled={withdraw.isPending}
                className="cursor-pointer"
              >
                {withdraw.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                Withdraw
              </Button>
            )}
            {involved && approval.status === "approved" && (
              <Button
                onClick={() => run.mutate()}
                disabled={run.isPending}
                className="cursor-pointer"
              >
                {run.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run now
              </Button>
            )}
            {decidable && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setDecision("reject")}
                  className="cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => setDecision("approve")}
                  className="cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
            {!decidable && approval.status === "pending" && !mine && (
              <p className="text-xs text-gray-500">
                {approval.approvals.some((entry) => entry.email === access?.email)
                  ? "You've approved this; it's waiting on others."
                  : `Only ${describeRequirement(1, approval.approverRank, approval.proposerRank).replace(/^1 approval from /, "")} can decide this.`}
              </p>
            )}
          </SheetFooter>
        )}

        {decision && (
          <DecisionDialog
            decision={decision}
            count={1}
            open
            pending={decide.isPending}
            onOpenChange={(open) => !open && setDecision(null)}
            onConfirm={(comment) => decide.mutate({ kind: decision, comment })}
            signs={signer.signs}
            blocked={signer.blocked}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
