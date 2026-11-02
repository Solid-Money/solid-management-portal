"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { canApproveFor } from "@/lib/admin-access";
import type {
  AdminAccessMe,
  AdminApproval,
  AdminApprovalStatus,
  AdminRank,
} from "@/types/admin-access";

const STATUS: Record<
  AdminApprovalStatus,
  {
    label: string;
    variant: "warning" | "info" | "success" | "danger" | "muted";
  }
> = {
  pending: { label: "Waiting", variant: "warning" },
  approved: { label: "Approved", variant: "info" },
  executing: { label: "Running", variant: "info" },
  executed: { label: "Approved · ran", variant: "success" },
  failed: { label: "Approved · failed", variant: "danger" },
  rejected: { label: "Rejected", variant: "danger" },
  expired: { label: "Expired", variant: "muted" },
  cancelled: { label: "Withdrawn", variant: "muted" },
};

export function ApprovalStatusBadge({
  status,
}: {
  status: AdminApprovalStatus;
}) {
  const { label, variant } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function RankBadge({ rank }: { rank: AdminRank }) {
  return (
    <Badge variant={rank === 1 ? "info" : "muted"} className="font-mono">
      R{rank}
    </Badge>
  );
}

/**
 * Whether the signed-in admin can decide this request: waiting, not theirs,
 * not already approved by them, and their rank is one the rule names.
 */
export function canDecide(
  approval: AdminApproval,
  me: AdminAccessMe | null
): boolean {
  if (!me || approval.status !== "pending") return false;
  if (approval.proposerEmail === me.email) return false;
  if (approval.approvals.some((entry) => entry.email === me.email)) {
    return false;
  }
  return canApproveFor(approval.approverRank, approval.proposerRank, me.rank);
}

/** Who asked, as a short name with their rank. */
export function Proposer({ approval }: { approval: AdminApproval }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-gray-900">
        {approval.proposerName ?? approval.proposerEmail.split("@")[0]}
      </span>
      <RankBadge rank={approval.proposerRank} />
    </span>
  );
}

/**
 * Approve or reject with an optional comment — one request or several. The
 * comment is kept on each request's history and posted to Slack on a
 * rejection.
 */
export function DecisionDialog({
  decision,
  count,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  decision: "approve" | "reject";
  count: number;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const approving = decision === "approve";
  const noun = count === 1 ? "this request" : `${count} requests`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setComment("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {approving ? "Approve" : "Reject"} {noun}
          </DialogTitle>
          <DialogDescription>
            {approving
              ? "A request runs the moment it has every approval it needs, so yours may run it. It runs as the admin who asked, and the result is shown here."
              : "One rejection closes a request; it never runs. The admin who asked sees your comment."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decision-comment">
            Comment{" "}
            <span className="text-muted-foreground">
              ({approving ? "optional" : "recommended"})
            </span>
          </Label>
          <Textarea
            id="decision-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            placeholder={
              approving
                ? "e.g. Checked the Intercom thread — the owner asked for it"
                : "e.g. The owner hasn't been verified yet"
            }
            disabled={pending}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant={approving ? "default" : "destructive"}
            onClick={() => onConfirm(comment.trim())}
            disabled={pending}
            className="cursor-pointer"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {approving ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
