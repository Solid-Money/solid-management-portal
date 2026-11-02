"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  Fingerprint,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import ApprovalKey, {
  ApprovalNotice,
} from "@/components/admin-access/approval-key";
import { RankBadge } from "@/components/approvals/approval-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { refreshSigning, saveSigningPasskey, setupSigning } from "@/lib/api";
import { isApprovalPending } from "@/lib/admin-access";
import {
  addAdminInTurnkey,
  addPasskeyInTurnkey,
  approveInTurnkey,
  createSigningPasskey,
  removeFromTurnkey,
  setRankInTurnkey,
} from "@/lib/turnkey-signing";
import { formatDateTime } from "@/lib/utils";
import {
  SIGNING_KEY,
  useAdminTeam,
  useSigningOverview,
} from "@/hooks/use-admin-access";
import type {
  AdminTeamMember,
  SigningEnrollment,
  SigningOverview,
  TurnkeyAdminUser,
} from "@/types/admin-access";

const SETUP_ACTION = "POST /admin-access/signing/setup";

const MODE_LABEL: Record<
  SigningOverview["mode"],
  { label: string; variant: "muted" | "warning" | "success" }
> = {
  off: { label: "Off — approvals are a click", variant: "muted" },
  optional: { label: "Optional — signed approvals are checked", variant: "warning" },
  required: { label: "Required — every approval is signed", variant: "success" },
};

/** A browser-side failure (a cancelled passkey prompt, a Turnkey refusal). */
function toastBrowserError(error: unknown) {
  if ((error as { response?: unknown }).response) return; // the API layer toasted it
  toast.error(error instanceof Error ? error.message : "Something went wrong");
}

/**
 * Run a root action in Turnkey from this browser with your passkey, then
 * re-read the sub-org so the page shows where it stands.
 */
function useTurnkeyAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      run,
    }: {
      run: () => Promise<"done" | "waiting">;
      done: string;
    }) => run(),
    onSuccess: async (result, { done }) => {
      toast.success(
        result === "waiting"
          ? `${done} — waiting for a second root admin to approve it in Turnkey`
          : done
      );
      await refreshSigning().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: SIGNING_KEY });
    },
    onError: toastBrowserError,
  });
}

function PinnedValue({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 shrink-0 text-gray-500">{label}</span>
      <code className="truncate rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-800">
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

function StatusCard({ overview }: { overview: SigningOverview }) {
  const mode = MODE_LABEL[overview.mode];
  const setup = overview.setup;
  const unpinned = setup?.status === "completed" && !overview.configured;
  const envLines =
    setup?.status === "completed"
      ? [
          `TURNKEY_ADMIN_SUB_ORG_ID=${setup.subOrganizationId}`,
          `TURNKEY_ADMIN_APPROVAL_WALLET_ID=${setup.walletId}`,
          `TURNKEY_ADMIN_APPROVAL_WALLET_ADDRESS=${setup.walletAddress}`,
          "ADMIN_APPROVAL_SIGNING=optional",
        ].join("\n")
      : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Status
          <Badge variant={mode.variant}>{mode.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!overview.subOrganizationId && (
          <p className="text-sm text-gray-600">
            Not set up yet. Once the root admins have each saved a passkey,
            create the admin sub-org below.
          </p>
        )}
        <PinnedValue label="Admin sub-org" value={overview.subOrganizationId} />
        <PinnedValue label="Approval wallet" value={overview.walletAddress} />
        {overview.turnkey?.quorum && (
          <p className="text-sm text-gray-600">
            Root actions need {overview.turnkey.quorum.threshold} of{" "}
            {overview.turnkey.quorum.userIds.length} root admins (
            {overview.rootAdmins.join(", ")}).
          </p>
        )}
        {unpinned && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p>
              The sub-org is set up but not pinned. Set these on
              accounts-service and redeploy — approvals are only ever checked
              against the sub-org pinned there, never one read from the
              database. Start with <code>optional</code>; switch to{" "}
              <code>required</code> once every admin can sign.
            </p>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded bg-white p-2 font-mono text-[11px] text-gray-800">
                {envLines}
              </pre>
              <CopyButton value={envLines} label="Environment" />
            </div>
          </div>
        )}
        {!overview.pinnedMatchesSetup && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            The pinned sub-org is not the one the setup created. Check the
            environment before turning signing on.
          </p>
        )}
        {overview.turnkeyError && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            Could not read the admin sub-org from Turnkey: {overview.turnkeyError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Make, or replace, the passkey you sign approvals with. */
function MyPasskeyCard({ overview }: { overview: SigningOverview }) {
  const { access } = useAuth();
  const queryClient = useQueryClient();
  const me = overview.me;

  const create = useMutation({
    mutationFn: async () => {
      const passkey = await createSigningPasskey(me.email, access?.name);
      return (await saveSigningPasskey(passkey.challenge, passkey.attestation))
        .data.data as { fingerprint: string };
    },
    onSuccess: (saved) => {
      toast.success(
        `Passkey saved (${saved.fingerprint}). Read this fingerprint to the root admin who adds you.`
      );
      void queryClient.invalidateQueries({ queryKey: SIGNING_KEY });
    },
    onError: toastBrowserError,
  });

  const waiting = me.enrollment?.status === "pending";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="h-4 w-4" />
          Your signing passkey
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {me.turnkey ? (
          <p className="text-gray-700">
            You sign approvals in Turnkey as{" "}
            {me.turnkey.rank ? <RankBadge rank={me.turnkey.rank} /> : "no rank"}
            {me.turnkey.root && (
              <Badge variant="info" className="ml-1.5">
                Root admin
              </Badge>
            )}
            {me.turnkey.passkeys.length > 0 && (
              <span className="ml-2 font-mono text-xs text-gray-500">
                passkey {me.turnkey.passkeys.join(", ")}
              </span>
            )}
          </p>
        ) : waiting ? (
          <p className="text-gray-700">
            Saved, waiting to be added. Your passkey&apos;s fingerprint is{" "}
            <span className="font-mono font-semibold">
              {me.enrollment!.fingerprint}
            </span>
            . Read it to the root admin adding you, so they know it&apos;s yours.
          </p>
        ) : (
          <p className="text-gray-700">
            You don&apos;t have one yet. It lives on this device (or your
            password manager) and is only ever used to sign approvals here.
          </p>
        )}
        <Button
          size="sm"
          variant={me.turnkey || waiting ? "outline" : "default"}
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="cursor-pointer"
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="h-4 w-4" />
          )}
          {me.turnkey
            ? "Add a passkey for a new device"
            : waiting
              ? "Make a new one instead"
              : "Create my signing passkey"}
        </Button>
        {me.turnkey && waiting && (
          <p className="text-xs text-gray-500">
            New passkey {me.enrollment!.fingerprint} is waiting for a root admin
            to add it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** The one-time setup: every root admin's passkey, then one approved action. */
function SetupCard({ overview }: { overview: SigningOverview }) {
  const queryClient = useQueryClient();
  const saved = new Set(
    overview.enrollments
      .filter((entry) => entry.status === "pending")
      .map((entry) => entry.email)
  );
  const ready = overview.rootAdmins.every((email) => saved.has(email));

  const setup = useMutation({
    mutationFn: setupSigning,
    onSuccess: () => {
      toast.success("Approval signing is set up in Turnkey");
      void queryClient.invalidateQueries({ queryKey: SIGNING_KEY });
    },
    onError: (error) => {
      if (isApprovalPending(error)) return; // announced by the API layer
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Set up the admin sub-org</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-gray-600">
          Creates the &ldquo;Solid Admins&rdquo; sub-org in Turnkey, once. Its
          root admins are below, and any {overview.rootThreshold} of them must
          approve every later change to it — adding or removing an admin,
          changing a rank. App users&apos; sub-orgs are not touched.
        </p>
        <ul className="space-y-1">
          {overview.rootAdmins.map((email) => (
            <li key={email} className="flex items-center gap-2">
              {saved.has(email) ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 text-gray-300" />
              )}
              <span>{email}</span>
              <span className="text-xs text-gray-500">
                {saved.has(email) ? "passkey saved" : "needs to create a passkey"}
              </span>
            </li>
          ))}
        </ul>
        {overview.setup?.status === "failed" && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            The last setup stopped: {overview.setup.error}
          </p>
        )}
        <ApprovalNotice action={SETUP_ACTION} />
        <Button
          onClick={() => setup.mutate()}
          disabled={!ready || setup.isPending}
          className="cursor-pointer"
        >
          {setup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Set up approval signing
          <ApprovalKey action={SETUP_ACTION} className="text-current" />
        </Button>
      </CardContent>
    </Card>
  );
}

/** One admin: their rank here against Turnkey's, and what a root admin can do. */
function AdminRow({
  email,
  member,
  turnkeyUser,
  enrollment,
  overview,
  canAct,
  action,
}: {
  email: string;
  member?: AdminTeamMember;
  turnkeyUser?: TurnkeyAdminUser;
  enrollment?: SigningEnrollment;
  overview: SigningOverview;
  canAct: boolean;
  action: ReturnType<typeof useTurnkeyAction>;
}) {
  const subOrganizationId = overview.subOrganizationId!;
  const tagIds = overview.turnkey?.tagIds ?? {};
  const ranked = member?.active ? member.rank : null;
  const newPasskey =
    enrollment?.status === "pending" &&
    enrollment.attestation &&
    enrollment.challenge &&
    !turnkeyUser?.passkeys.includes(enrollment.fingerprint)
      ? enrollment
      : null;

  let control: React.ReactNode = null;
  if (canAct) {
    if (!turnkeyUser && ranked && newPasskey) {
      const tagId = tagIds[ranked];
      control = (
        <Button
          size="sm"
          disabled={action.isPending || !tagId}
          onClick={() =>
            action.mutate({
              done: `Asked Turnkey to add ${email} as rank ${ranked}`,
              run: () =>
                addAdminInTurnkey({
                  subOrganizationId,
                  email,
                  rankTagId: tagId!,
                  challenge: newPasskey.challenge!,
                  attestation: newPasskey.attestation!,
                }),
            })
          }
          className="cursor-pointer"
        >
          <Fingerprint className="h-4 w-4" />
          Add with passkey {newPasskey.fingerprint}
        </Button>
      );
    } else if (turnkeyUser && ranked && turnkeyUser.rank !== ranked) {
      control = (
        <Button
          size="sm"
          variant="outline"
          disabled={action.isPending}
          onClick={() =>
            action.mutate({
              done: `Asked Turnkey to set ${email} to rank ${ranked}`,
              run: () =>
                setRankInTurnkey({
                  subOrganizationId,
                  userId: turnkeyUser.userId,
                  rank: ranked,
                  tagIds,
                }),
            })
          }
          className="cursor-pointer"
        >
          Set Turnkey rank to {ranked}
        </Button>
      );
    } else if (turnkeyUser && ranked && newPasskey) {
      control = (
        <Button
          size="sm"
          variant="outline"
          disabled={action.isPending}
          onClick={() =>
            action.mutate({
              done: `Asked Turnkey to add ${email}'s new passkey`,
              run: () =>
                addPasskeyInTurnkey({
                  subOrganizationId,
                  userId: turnkeyUser.userId,
                  challenge: newPasskey.challenge!,
                  attestation: newPasskey.attestation!,
                }),
            })
          }
          className="cursor-pointer"
        >
          Add new passkey {newPasskey.fingerprint}
        </Button>
      );
    } else if (turnkeyUser && !ranked && !turnkeyUser.root) {
      control = (
        <Button
          size="sm"
          variant="destructive"
          disabled={action.isPending}
          onClick={() =>
            action.mutate({
              done: `Asked Turnkey to remove ${email}`,
              run: () =>
                removeFromTurnkey({
                  subOrganizationId,
                  userId: turnkeyUser.userId,
                }),
            })
          }
          className="cursor-pointer"
        >
          Remove from Turnkey
        </Button>
      );
    }
  }

  const mismatch = turnkeyUser && ranked && turnkeyUser.rank !== ranked;

  return (
    <TableRow>
      <TableCell>
        <span className="text-gray-900">{email}</span>
        {turnkeyUser?.root && (
          <Badge variant="info" className="ml-1.5">
            Root
          </Badge>
        )}
      </TableCell>
      <TableCell>{ranked ? <RankBadge rank={ranked} /> : <Badge variant="muted">No rank</Badge>}</TableCell>
      <TableCell>
        {turnkeyUser ? (
          turnkeyUser.rank ? (
            <span className="inline-flex items-center gap-1.5">
              <RankBadge rank={turnkeyUser.rank} />
              {mismatch && <Badge variant="warning">Differs</Badge>}
            </span>
          ) : (
            <Badge variant="warning">No rank tag</Badge>
          )
        ) : (
          <span className="text-gray-400">Not added</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-gray-500">
        {turnkeyUser?.passkeys.join(", ") || "—"}
        {newPasskey && (
          <span className="ml-1 text-amber-700">(new {newPasskey.fingerprint})</span>
        )}
      </TableCell>
      <TableCell className="text-right">{control}</TableCell>
    </TableRow>
  );
}

/**
 * Config → Internal Team → Approval signing: admins approve with their own
 * passkey through Turnkey, in a sub-org only they control, so an approval
 * can't be forged from our side.
 */
export default function ApprovalSigningSection() {
  const { access } = useAuth();
  const { data: overview, isLoading, error } = useSigningOverview();
  const { data: team } = useAdminTeam();
  const action = useTurnkeyAction();

  if (error) {
    return <p className="text-sm text-red-700">Could not load approval signing.</p>;
  }
  if (isLoading || !overview) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const setUp = overview.setup?.status === "completed";
  const turnkey = overview.turnkey;
  const canAct = overview.isRootAdmin && !!overview.subOrganizationId && !!turnkey;

  // Everyone with a rank here, and anyone Turnkey still holds.
  const emails = [
    ...new Set([
      ...(team ?? []).filter((member) => member.active).map((member) => member.email),
      ...(turnkey?.users ?? []).map((user) => user.email).filter((email): email is string => !!email),
    ]),
  ];
  const myEmail = access?.email;

  return (
    <div className="space-y-4">
      <StatusCard overview={overview} />
      <MyPasskeyCard overview={overview} />
      {!setUp && <SetupCard overview={overview} />}

      {setUp && turnkey && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admins in Turnkey</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              Turnkey&apos;s rank is the one a signed approval goes by.
              {canAct
                ? " As a root admin you can add, re-rank or remove admins; each change waits in Turnkey for a second root admin. Check a new passkey's fingerprint with its owner before adding it."
                : " Root admins add, re-rank and remove admins here."}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Rank here</TableHead>
                  <TableHead>Rank in Turnkey</TableHead>
                  <TableHead>Passkeys</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <AdminRow
                    key={email}
                    email={email}
                    member={team?.find((member) => member.email === email)}
                    turnkeyUser={turnkey.users.find((user) => user.email === email)}
                    enrollment={overview.enrollments.find((entry) => entry.email === email)}
                    overview={overview}
                    canAct={canAct}
                    action={action}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {setUp && turnkey && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Waiting in Turnkey ({turnkey.pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {turnkey.pending.length === 0 ? (
              <p className="text-sm text-gray-500">
                No root action is waiting for a second root admin.
              </p>
            ) : (
              <ul className="space-y-2">
                {turnkey.pending.map((activity) => {
                  const mine =
                    !!myEmail &&
                    (activity.requestedBy === myEmail ||
                      activity.approvedBy.includes(myEmail));
                  return (
                    <li
                      key={activity.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{activity.summary}</p>
                        <p className="text-xs text-gray-500">
                          Asked by {activity.requestedBy ?? "a root admin"}
                          {activity.createdAt
                            ? ` · ${formatDateTime(activity.createdAt)}`
                            : ""}
                          {activity.approvedBy.length
                            ? ` · approved by ${activity.approvedBy.join(", ")}`
                            : ""}
                        </p>
                      </div>
                      {canAct && !mine && (
                        <Button
                          size="sm"
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({
                              done: "Approved in Turnkey",
                              run: () =>
                                approveInTurnkey({
                                  subOrganizationId: overview.subOrganizationId!,
                                  fingerprint: activity.fingerprint,
                                }),
                            })
                          }
                          className="cursor-pointer"
                        >
                          <Fingerprint className="h-4 w-4" />
                          Approve in Turnkey
                        </Button>
                      )}
                      {mine && <Badge variant="muted">Waiting on another root admin</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
