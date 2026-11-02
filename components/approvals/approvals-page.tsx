"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import UserLink from "@/components/user-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApprovalDetailSheet from "@/components/approvals/approval-detail-sheet";
import {
  ApprovalStatusBadge,
  DecisionDialog,
  Proposer,
  canDecide,
} from "@/components/approvals/approval-parts";
import { decideApprovals, getApprovals } from "@/lib/api";
import { describeRequirement } from "@/lib/admin-access";
import { formatDateTime } from "@/lib/utils";
import { useUrlTab } from "@/hooks/use-url-tab";
import { APPROVAL_SUMMARY_KEY } from "@/hooks/use-admin-access";
import { useApprovalSigner } from "@/hooks/use-approval-signer";
import type {
  AdminApproval,
  AdminApprovalGroup,
  AdminApprovalList,
} from "@/types/admin-access";

const GROUPS: readonly AdminApprovalGroup[] = [
  "pending",
  "signed",
  "rejected",
  "closed",
];

const GROUP_LABEL: Record<AdminApprovalGroup, string> = {
  pending: "Pending",
  signed: "Signed",
  rejected: "Rejected",
  closed: "Expired & withdrawn",
};

const EMPTY: Record<AdminApprovalGroup, string> = {
  pending: "Nothing is waiting for approval.",
  signed: "No request has been approved yet.",
  rejected: "No request has been rejected.",
  closed: "No request has expired or been withdrawn.",
};

const shortDate = (value: string) =>
  formatDateTime(value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Who decided a closed request, in a line. */
function decidedBy(approval: AdminApproval): string {
  if (approval.rejection) return approval.rejection.email;
  if (approval.approvals.length) {
    return approval.approvals.map((entry) => entry.email).join(", ");
  }
  return "—";
}

/**
 * Activity → Approvals: portal actions held for another admin's approval.
 *
 * Pending requests the signed-in admin can decide are approved or rejected one
 * at a time, from their detail, or in bulk from the table; the rest show who
 * they are waiting on. A request runs the moment its last approval lands, as
 * the admin who asked for it, so Signed shows how each run went.
 */
export default function ApprovalsPage() {
  const { access } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [group, setGroup] = useUrlTab(GROUPS, "pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<"approve" | "reject" | null>(null);
  const openId = searchParams.get("id");
  const signer = useApprovalSigner();

  const { data, isLoading, error } = useQuery<AdminApprovalList>({
    queryKey: ["approvals", group],
    queryFn: async () => (await getApprovals(group)).data.data,
    refetchInterval: group === "pending" ? 30_000 : false,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const decidable = useMemo(
    () => items.filter((item) => canDecide(item, access)),
    [items, access]
  );
  const chosen = decidable.filter((item) => selected.has(item.id));

  const openDetail = (id: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("id", id);
    else params.delete("id");
    const query = params.toString();
    router.replace(`/activity/approvals${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  const decideMany = useMutation({
    mutationFn: async ({
      decision,
      comment,
    }: {
      decision: "approve" | "reject";
      comment: string;
    }) => {
      const ids = chosen.map((item) => item.id);
      // One passkey prompt covers every selected request.
      const signature =
        decision === "approve" ? await signer.sign(ids) : undefined;
      return (await decideApprovals(ids, decision, comment, signature)).data
        .data;
    },
    onError: (error) => {
      if (!(error as { response?: unknown }).response) {
        toast.error(error instanceof Error ? error.message : "Could not sign");
      }
    },
    onSuccess: (results, { decision }) => {
      setBulk(null);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: APPROVAL_SUMMARY_KEY });
      const failed = results.filter(
        (result) => !result.ok || result.approval?.status === "failed"
      );
      const done = results.length - failed.length;
      if (done) {
        toast.success(
          `${done} request${done === 1 ? "" : "s"} ${decision === "approve" ? "approved" : "rejected"}`
        );
      }
      for (const result of failed) {
        toast.error(
          result.error ??
            `Approved, but it failed: ${result.approval?.execution?.error ?? "unknown error"}`,
          { description: result.approval?.label ?? result.id }
        );
      }
    },
  });

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const allChosen =
    decidable.length > 0 && chosen.length === decidable.length
      ? true
      : chosen.length > 0
        ? "indeterminate"
        : false;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
          <KeyRound className="h-6 w-6 text-amber-600" />
          Approvals
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Sensitive actions wait here until another admin approves them — from
          a higher rank, or another rank 1 admin for a rank 1 request. The last
          approval runs the action as the admin who asked. A request expires
          after 24 hours. Which actions need approval, and from whom, is set
          under Config → Internal Team → Approval rules.
        </p>
      </div>

      <Tabs
        value={group}
        onValueChange={(next) => {
          setGroup(next);
          setSelected(new Set());
        }}
      >
        <TabsList>
          {GROUPS.map((key) => (
            <TabsTrigger key={key} value={key} className="cursor-pointer">
              {GROUP_LABEL[key]}
              {data?.counts[key] ? (
                <Badge
                  variant={key === "pending" ? "warning" : "muted"}
                  className="ml-1.5"
                >
                  {data.counts[key]}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {group === "pending" && decidable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
          <span className="text-gray-600">
            {chosen.length
              ? `${chosen.length} selected`
              : `${decidable.length} waiting on you — select to decide in bulk`}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={!chosen.length}
              onClick={() => setBulk("reject")}
              className="cursor-pointer"
            >
              <X className="h-4 w-4" />
              Reject selected
            </Button>
            <Button
              size="sm"
              disabled={!chosen.length}
              onClick={() => setBulk("approve")}
              className="cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Approve selected
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent>
          {error ? (
            <p className="text-sm text-red-700">Could not load approvals.</p>
          ) : isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              {EMPTY[group]}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {group === "pending" && (
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allChosen}
                        disabled={!decidable.length}
                        onCheckedChange={(on) =>
                          setSelected(
                            on === true
                              ? new Set(decidable.map((item) => item.id))
                              : new Set()
                          )
                        }
                        aria-label="Select every request you can decide"
                      />
                    </TableHead>
                  )}
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Asked by</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>
                    {group === "pending" ? "Needs" : "Decided by"}
                  </TableHead>
                  <TableHead>{group === "pending" ? "Expires" : "Status"}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const canPick = canDecide(item, access);
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(item.id)}
                    >
                      {group === "pending" && (
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(item.id)}
                            disabled={!canPick}
                            onCheckedChange={(on) => toggle(item.id, on === true)}
                            aria-label={`Select ${item.label}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="max-w-64 whitespace-normal">
                        <span className="font-medium text-gray-900">
                          {item.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.targetUserId ? (
                          <UserLink userId={item.targetUserId} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Proposer approval={item} />
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-gray-600">
                        {item.reason ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal text-gray-600">
                        {group === "pending" ? (
                          <>
                            {item.approvals.length}/{item.requiredApprovals} ·{" "}
                            {describeRequirement(
                              item.requiredApprovals,
                              item.approverRank,
                              item.proposerRank
                            ).replace(/^\d+ approvals? from /, "")}
                          </>
                        ) : (
                          decidedBy(item)
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {group === "pending" ? (
                          shortDate(item.expiresAt)
                        ) : (
                          <ApprovalStatusBadge status={item.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={canPick ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetail(item.id);
                          }}
                        >
                          {canPick ? "Review" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bulk && (
        <DecisionDialog
          decision={bulk}
          count={chosen.length}
          open
          pending={decideMany.isPending}
          onOpenChange={(open) => !open && setBulk(null)}
          onConfirm={(comment) => decideMany.mutate({ decision: bulk, comment })}
          signs={signer.signs}
          blocked={signer.blocked}
        />
      )}

      <ApprovalDetailSheet id={openId} onClose={() => openDetail(null)} />
    </div>
  );
}
