"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldMinus, ShieldPlus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import ApprovalKey, {
  ApprovalNotice,
} from "@/components/admin-access/approval-key";
import { RankBadge } from "@/components/approvals/approval-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getAllowedDomain } from "@/lib/auth";
import { revokeAdminRank, setAdminRank } from "@/lib/api";
import { isApprovalPending } from "@/lib/admin-access";
import { formatDateTime } from "@/lib/utils";
import { ADMIN_TEAM_KEY, useAdminTeam } from "@/hooks/use-admin-access";
import {
  ADMIN_RANKS,
  type AdminRank,
  type AdminTeamMember,
} from "@/types/admin-access";

const ASSIGN_ACTION = "POST /admin-access/members";
const REVOKE_ACTION = "POST /admin-access/members/revoke";

const RANK_LABEL: Record<AdminRank, string> = {
  1: "Rank 1 — most access",
  2: "Rank 2",
  3: "Rank 3",
  4: "Rank 4 — least access",
};

const shortDate = (value?: string) =>
  value
    ? formatDateTime(value, { month: "short", day: "numeric", year: "numeric" })
    : "—";

/** The ranks the signed-in admin may hand out: their own and below. */
function assignableRanks(myRank: AdminRank | undefined): AdminRank[] {
  return ADMIN_RANKS.filter((rank) => myRank !== undefined && rank >= myRank);
}

function RankSelect({
  value,
  onChange,
  ranks,
  disabled,
  id,
}: {
  value: AdminRank | null;
  onChange: (rank: AdminRank) => void;
  ranks: AdminRank[];
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select
      value={value ? String(value) : undefined}
      onValueChange={(next) => onChange(Number(next) as AdminRank)}
      disabled={disabled || ranks.length === 0}
    >
      <SelectTrigger id={id} size="sm" className="w-52 cursor-pointer">
        <SelectValue placeholder="Choose a rank" />
      </SelectTrigger>
      <SelectContent>
        {ranks.map((rank) => (
          <SelectItem key={rank} value={String(rank)}>
            {RANK_LABEL[rank]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The result of a rank change: done, or sent for approval (already toasted). */
function useRankMutation<T>(
  run: (input: T) => Promise<unknown>,
  done: string | ((input: T) => string),
  onSettled?: () => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (_, input) => {
      toast.success(typeof done === "string" ? done : done(input));
      void queryClient.invalidateQueries({ queryKey: ADMIN_TEAM_KEY });
      onSettled?.();
    },
    onError: (error) => {
      if (isApprovalPending(error)) onSettled?.();
    },
  });
}

function AddAdminForm({ myRank }: { myRank?: AdminRank }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [rank, setRank] = useState<AdminRank | null>(null);
  const domain = getAllowedDomain();
  const trimmed = email.trim().toLowerCase();
  const valid = trimmed.endsWith(`@${domain}`) && trimmed.length > domain.length + 1;

  const mutation = useRankMutation(
    () => setAdminRank(trimmed, rank!, name.trim() || undefined),
    `${trimmed} can now sign in`,
    () => {
      setEmail("");
      setName("");
      setRank(null);
    }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4" />
          Give someone a rank
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Google Workspace email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={`name@${domain}`}
              className="w-64"
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-name">
              Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="admin-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-40"
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-rank">Rank</Label>
            <RankSelect
              id="admin-rank"
              value={rank}
              onChange={setRank}
              ranks={assignableRanks(myRank)}
              disabled={mutation.isPending}
            />
          </div>
          <Button
            onClick={() => mutation.mutate(undefined)}
            disabled={!valid || !rank || mutation.isPending}
            className="cursor-pointer"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldPlus className="h-4 w-4" />
            )}
            Give rank
            <ApprovalKey action={ASSIGN_ACTION} className="text-current" />
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Only @{domain} accounts with a rank can sign in to this portal. You can
          give your own rank or a lower one.
        </p>
        <ApprovalNotice action={ASSIGN_ACTION} />
      </CardContent>
    </Card>
  );
}

function RevokeDialog({ member }: { member: AdminTeamMember }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const mutation = useRankMutation(
    () => revokeAdminRank(member.email, trimmed),
    `${member.email} can no longer sign in`,
    () => {
      setOpen(false);
      setReason("");
    }
  );

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <ShieldMinus className="h-4 w-4" />
        Remove rank
        <ApprovalKey action={REVOKE_ACTION} />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !mutation.isPending && setOpen(next)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {member.email}&apos;s rank</DialogTitle>
            <DialogDescription>
              They lose access to the portal on their next request — within
              seconds. Their requests still waiting for approval are cancelled
              when someone tries to approve them. You can give them a rank again
              later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="revoke-reason">Reason</Label>
            <Textarea
              id="revoke-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Left the company"
              disabled={mutation.isPending}
            />
          </div>
          <ApprovalNotice action={REVOKE_ACTION} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => mutation.mutate(undefined)}
              disabled={!trimmed || mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Remove rank
              <ApprovalKey action={REVOKE_ACTION} className="text-current" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A member's rank, changeable when they are not above the signed-in admin. */
function RankCell({
  member,
  myEmail,
  myRank,
}: {
  member: AdminTeamMember;
  myEmail?: string;
  myRank?: AdminRank;
}) {
  const [rank, setRank] = useState<AdminRank>(member.rank);
  const editable =
    myRank !== undefined &&
    member.email !== myEmail &&
    (!member.active || member.rank >= myRank);
  const mutation = useRankMutation(
    () => setAdminRank(member.email, rank),
    `${member.email} is now rank ${rank}`
  );

  if (!editable) return <RankBadge rank={member.rank} />;

  return (
    <div className="flex items-center gap-2">
      <RankSelect
        value={rank}
        onChange={setRank}
        ranks={assignableRanks(myRank)}
        disabled={mutation.isPending}
      />
      {(rank !== member.rank || !member.active) && (
        <Button
          size="sm"
          onClick={() => mutation.mutate(undefined)}
          disabled={mutation.isPending}
          className="cursor-pointer"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {member.active ? "Save" : "Give rank back"}
          <ApprovalKey action={ASSIGN_ACTION} className="text-current" />
        </Button>
      )}
    </div>
  );
}

/**
 * Admin access: who may use this portal, at what rank. Separate from the
 * internal team above, which is about app accounts and team-only features —
 * this is about who can sign in here and what they can approve.
 */
export default function AdminTeamSection() {
  const { access } = useAuth();
  const { data: members, isLoading, error } = useAdminTeam();
  const active = members?.filter((member) => member.active) ?? [];
  const revoked = members?.filter((member) => !member.active) ?? [];

  if (error) {
    return (
      <p className="text-sm text-red-700">Could not load the admin team.</p>
    );
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
      <AddAdminForm myRank={access?.rank} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Admins with a rank ({active.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Added by</TableHead>
                <TableHead>Since</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((member) => (
                <TableRow key={member.email}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {member.name ?? member.email.split("@")[0]}
                        {member.email === access?.email && (
                          <Badge variant="muted" className="ml-1.5">
                            You
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">{member.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RankCell
                      member={member}
                      myEmail={access?.email}
                      myRank={access?.rank}
                    />
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {member.source === "seed" ? (
                      <Badge variant="muted">First team</Badge>
                    ) : (
                      (member.addedBy ?? "—")
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {shortDate(member.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {access &&
                      member.email !== access.email &&
                      member.rank >= access.rank && (
                        <RevokeDialog member={member} />
                      )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {revoked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rank removed ({revoked.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Removed by</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Give a rank back</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revoked.map((member) => (
                  <TableRow key={member.email}>
                    <TableCell>
                      <span className="text-gray-900">{member.email}</span>
                      <span className="ml-1.5 text-xs text-gray-500">
                        (was rank {member.rank})
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {member.revokedBy ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-gray-500">
                      {member.revokedReason ?? "—"}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {shortDate(member.revokedAt)}
                    </TableCell>
                    <TableCell>
                      <RankCell
                        member={member}
                        myEmail={access?.email}
                        myRank={access?.rank}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
