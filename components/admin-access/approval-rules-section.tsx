"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import ApprovalKey, {
  ApprovalNotice,
} from "@/components/admin-access/approval-key";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setActionPolicy } from "@/lib/api";
import { describeProposers, isApprovalPending } from "@/lib/admin-access";
import {
  ACTION_POLICIES_KEY,
  useActionPolicies,
} from "@/hooks/use-admin-access";
import type {
  AdminActionPolicyRow,
  AdminRank,
  ApproverRank,
} from "@/types/admin-access";

const SET_POLICY_ACTION = "POST /admin-access/policies";

const APPROVER_OPTIONS: { value: string; label: string }[] = [
  { value: "above_proposer", label: "Any higher rank" },
  { value: "1", label: "Rank 1" },
  { value: "2", label: "Rank 1–2" },
  { value: "3", label: "Rank 1–3" },
  { value: "4", label: "Any rank" },
];

const PROPOSER_OPTIONS: AdminRank[] = [4, 3, 2, 1];

const parseApprover = (value: string): ApproverRank =>
  value === "above_proposer" ? value : (Number(value) as AdminRank);

/** One action's rule, edited in place and saved on its own. */
function RuleRow({ row }: { row: AdminActionPolicyRow }) {
  const queryClient = useQueryClient();
  const [required, setRequired] = useState(row.requiredApprovals);
  const [approver, setApprover] = useState<ApproverRank>(row.approverRank);
  const [proposer, setProposer] = useState<AdminRank>(row.proposerRank);
  const changed =
    required !== row.requiredApprovals ||
    approver !== row.approverRank ||
    proposer !== row.proposerRank;

  const mutation = useMutation({
    mutationFn: () =>
      setActionPolicy({
        action: row.action,
        requiredApprovals: required,
        approverRank: approver,
        proposerRank: proposer,
      }),
    onSuccess: () => {
      toast.success(`Rule saved: ${row.label}`);
      void queryClient.invalidateQueries({ queryKey: ACTION_POLICIES_KEY });
    },
    onError: (error) => {
      // Sent for approval: show the rule as it stands until it is approved.
      if (isApprovalPending(error)) {
        setRequired(row.requiredApprovals);
        setApprover(row.approverRank);
        setProposer(row.proposerRank);
      }
    },
  });

  return (
    <TableRow>
      <TableCell className="max-w-72 whitespace-normal">
        <div className="flex items-center gap-1.5 font-medium text-gray-900">
          {row.label}
          <ApprovalKey action={row.action} />
        </div>
        <div className="font-mono text-[11px] text-gray-500">{row.action}</div>
        <div className="mt-1 flex gap-1">
          {row.custom ? (
            <Badge variant="info">Custom{row.updatedBy ? ` · ${row.updatedBy}` : ""}</Badge>
          ) : row.sensitiveByDefault ? (
            <Badge variant="warning">Sensitive by default</Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Select
          value={String(required)}
          onValueChange={(value) => setRequired(Number(value))}
          disabled={mutation.isPending}
        >
          <SelectTrigger size="sm" className="w-36 cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">None</SelectItem>
            <SelectItem value="1">1 approval</SelectItem>
            <SelectItem value="2">2 approvals</SelectItem>
            <SelectItem value="3">3 approvals</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={String(approver)}
          onValueChange={(value) => setApprover(parseApprover(value))}
          disabled={mutation.isPending || required === 0}
        >
          <SelectTrigger size="sm" className="w-40 cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPROVER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={String(proposer)}
          onValueChange={(value) => setProposer(Number(value) as AdminRank)}
          disabled={mutation.isPending}
        >
          <SelectTrigger size="sm" className="w-36 cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPOSER_OPTIONS.map((rank) => (
              <SelectItem key={rank} value={String(rank)}>
                {describeProposers(rank)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          disabled={!changed || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="cursor-pointer"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
          <ApprovalKey action={SET_POLICY_ACTION} className="text-current" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Approval rules: for every portal action that changes something — each
 * button, including ones added later — how many approvals it needs, from which
 * ranks, and which ranks may start it at all. Changing a rule is itself held
 * for approval, so a single account can't switch the protection off.
 */
export default function ApprovalRulesSection() {
  const { data: rows, isLoading, error } = useActionPolicies();
  const [query, setQuery] = useState("");
  const [onlyGated, setOnlyGated] = useState(false);

  const areas = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = (rows ?? []).filter(
      (row) =>
        (!onlyGated || row.requiredApprovals > 0 || row.proposerRank < 4) &&
        (!needle ||
          row.label.toLowerCase().includes(needle) ||
          row.action.toLowerCase().includes(needle) ||
          row.area.toLowerCase().includes(needle))
    );
    const grouped = new Map<string, AdminActionPolicyRow[]>();
    for (const row of matching) {
      grouped.set(row.area, [...(grouped.get(row.area) ?? []), row]);
    }
    return [...grouped.entries()];
  }, [rows, query, onlyGated]);

  const gatedCount = rows?.filter((row) => row.requiredApprovals > 0).length ?? 0;

  if (error) {
    return <p className="text-sm text-red-700">Could not load the approval rules.</p>;
  }
  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-sm text-gray-600">
        <KeyRound className="h-4 w-4 text-amber-600" />
        {gatedCount} of {rows?.length ?? 0} actions need approval. Buttons for
        them carry a key.
      </p>
      <p className="text-xs text-gray-500">
        <span className="font-medium">Approvals: None</span> runs the action at
        once. <span className="font-medium">From: Any higher rank</span> means
        anyone ranked above whoever asked — rank 4 goes to ranks 1–3, and a
        rank 1 request goes to another rank 1 admin. A set rank means that rank
        and every rank above it. The admin who asked never approves their own
        request.
      </p>
      <ApprovalNotice action={SET_POLICY_ACTION} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actions"
            className="w-72 pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="only-gated"
            checked={onlyGated}
            onCheckedChange={setOnlyGated}
          />
          <Label htmlFor="only-gated" className="cursor-pointer">
            Only actions with a rule
          </Label>
        </div>
      </div>

      {areas.length === 0 ? (
        <p className="text-sm text-gray-500">No action matches.</p>
      ) : (
        areas.map(([area, areaRows]) => (
          <div key={area} className="rounded-md border border-gray-200">
            <h3 className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
              {area}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Approvals</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Who can start it</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {areaRows.map((row) => (
                  <RuleRow
                    // Remount when the saved rule changes, so the selects reset to it.
                    key={`${row.action}:${row.requiredApprovals}:${row.approverRank}:${row.proposerRank}`}
                    row={row}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}
    </div>
  );
}
