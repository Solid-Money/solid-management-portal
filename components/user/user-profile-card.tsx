"use client";

import Link from "next/link";
import { ExternalLink, UserCircle } from "lucide-react";

import { User } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyableValue } from "@/components/ui/copy-button";

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

const KYC_VARIANT: Record<string, "success" | "warning" | "danger" | "muted"> = {
  approved: "success",
  under_review: "warning",
  rejected: "danger",
};

/**
 * Where the user came from and how to find them elsewhere.
 *
 * The referral block answers "where were they referred from?" in one place:
 * the code they entered, and — when we resolved it — the account that owns it,
 * linked so support can walk the chain upward.
 */
export default function UserProfileCard({ user }: { user: User }) {
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
