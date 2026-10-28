"use client";

import Link from "next/link";
import { ExternalLink, ShieldAlert, UserCircle } from "lucide-react";

import { formatDateTime } from "@/lib/utils";
import { User } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyableValue } from "@/components/ui/copy-button";
import RecoverAccountDialog from "@/components/user/recover-account-dialog";
import UserTwoFactorField from "@/components/user/user-two-factor-field";

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

/**
 * An account an admin closed for security — one that linked a Safe it did not
 * own. Said in full rather than as a badge, because the first thing support
 * will try is "Recover account", and it is deliberately not there.
 */
function SecurityClosedNotice({
  hold,
}: {
  hold: NonNullable<User["securityHold"]>;
}) {
  return (
    <div className="w-full space-y-2">
      <Badge variant="danger">Closed for security</Badge>
      <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p>
            Closed by {hold.adminEmail} on {formatDateTime(hold.at)}:{" "}
            <span className="font-medium">{hold.reason}</span>
          </p>
          {hold.safeAddress && (
            <p className="flex flex-wrap items-center gap-1">
              It was linked to a Safe it does not own:
              <CopyableValue value={hold.safeAddress} label="Safe" />
            </p>
          )}
          <p>
            This account cannot be recovered or reopened, here or on request.
            Its sessions, two-factor and card spending were removed, and the
            Safe it pointed at belongs to another user, who is unaffected.
          </p>
        </div>
      </div>
    </div>
  );
}

const KYC_VARIANT: Record<string, "success" | "warning" | "danger" | "muted"> = {
  approved: "success",
  under_review: "warning",
  rejected: "danger",
};

const CARD_PROVIDER_LABEL: Record<string, string> = {
  rain: "Rain",
  wirex: "Wirex",
};

/**
 * Where the user came from and how to find them elsewhere.
 *
 * The referral block answers "where were they referred from?" in one place:
 * the code they entered, and — when we resolved it — the account that owns it,
 * linked so support can walk the chain upward.
 *
 * The account status sits first because a closed account changes how every
 * other panel reads: the user cannot sign in, so "they can't see their funds"
 * is answered here before anyone goes looking at deposits.
 */
export default function UserProfileCard({ user }: { user: User }) {
  const closed = Boolean(user.isDeleted);
  const securityHold = user.securityHold ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-gray-400" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <Field label="Account status" wide>
            <div className="flex flex-wrap items-center gap-2">
              {securityHold ? (
                <SecurityClosedNotice hold={securityHold} />
              ) : closed ? (
                <>
                  <Badge variant="danger">Closed</Badge>
                  <span className="text-gray-600">
                    {user.deletedAt
                      ? `Deleted from the app on ${formatDateTime(user.deletedAt)}`
                      : "Deleted from the app"}{" "}
                    — they cannot sign in until it is recovered.
                  </span>
                </>
              ) : (
                <Badge variant="success">Open</Badge>
              )}
              <span className={closed ? "ml-auto" : undefined}>
                <RecoverAccountDialog
                  userId={user._id}
                  username={user.username || user.email || user._id}
                  // Never offered for a security close: the backend refuses it.
                  closed={closed && !securityHold}
                  closedAt={user.deletedAt}
                />
              </span>
            </div>
          </Field>
          <Field label="Two-factor (authenticator app)" wide>
            {securityHold ? (
              <span className="text-gray-600">
                Removed when the account was closed for security.
              </span>
            ) : (
              <UserTwoFactorField
                userId={user._id}
                username={user.username || user.email || user._id}
              />
            )}
          </Field>
          <Field label="User ID" wide>
            <CopyableValue value={user._id} label="User ID" />
          </Field>
          <Field label="Email" wide>
            <span className="flex items-center gap-1">
              <span className="truncate">{user.email || "—"}</span>
              {user.email && (
                <CopyableValue value={user.email} label="Email" />
              )}
            </span>
          </Field>
          <Field label="Wallet (EOA)" wide>
            <CopyableValue
              value={user.walletAddress}
              label="Wallet address"
              truncate
              href={
                user.walletAddress
                  ? `https://explorer.fuse.io/address/${user.walletAddress}`
                  : undefined
              }
            />
          </Field>
          <Field label="Safe address" wide>
            <CopyableValue
              value={user.safeAddress}
              label="Safe address"
              truncate
              href={
                user.safeAddress
                  ? `https://explorer.fuse.io/address/${user.safeAddress}`
                  : undefined
              }
            />
          </Field>
          <Field label="Country">{user.country || "—"}</Field>
          <Field label="Joined">
            {new Date(user.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Field>
          <Field label="Last activity">
            {user.lastActivityTimestamp
              ? new Date(user.lastActivityTimestamp).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"}
          </Field>
          <Field label="Own referral code">
            <CopyableValue value={user.referralCode} label="Referral code" />
          </Field>

          <Field label="Referred from" wide>
            {user.referredBy || user.referralCodeUsed ? (
              <div className="flex flex-wrap items-center gap-2">
                {user.referredBy ? (
                  <Link
                    href={`/users/${user.referredBy.id}`}
                    className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {user.referredBy.username}
                  </Link>
                ) : (
                  <span className="text-gray-500">Unresolved referrer</span>
                )}
                {user.referralCodeUsed && (
                  <>
                    <span className="text-gray-400">via</span>
                    <Link
                      href={`/referrals?code=${encodeURIComponent(user.referralCodeUsed)}`}
                      className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {user.referralCodeUsed}
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <span className="text-gray-500">
                Organic — no referral code was used
              </span>
            )}
          </Field>

          {user.cardCustomers?.map((customer, i) => {
            const label = `${CARD_PROVIDER_LABEL[customer.provider] ?? customer.provider} user ID`;
            return (
              <Field
                key={`${customer.provider}-${customer.providerUserId ?? i}`}
                label={label}
                wide
              >
                <div className="flex flex-wrap items-center gap-2">
                  {customer.providerUserId ? (
                    <CopyableValue
                      value={customer.providerUserId}
                      label={label}
                    />
                  ) : (
                    <span className="text-gray-500">
                      Not registered with the issuer yet
                    </span>
                  )}
                  <Badge variant={KYC_VARIANT[customer.kycStatus] ?? "muted"}>
                    {customer.kycStatus}
                  </Badge>
                </div>
              </Field>
            );
          })}

          {user.bridgeCustomers && user.bridgeCustomers.length > 0 && (
            <Field label="Bridge.xyz customers (legacy)" wide>
              <div className="space-y-1">
                {user.bridgeCustomers.map((customer) => (
                  <div
                    key={customer.bridgeCustomerId}
                    className="flex items-center gap-2"
                  >
                    <a
                      href={`https://dashboard.bridge.xyz/app/customers/${customer.bridgeCustomerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {customer.bridgeCustomerId}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <Badge variant={KYC_VARIANT[customer.kycStatus] ?? "muted"}>
                      {customer.kycStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            </Field>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
