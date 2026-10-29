"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { getKycResetEligibility } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { KycResetEligibility } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ResetKycDialog from "@/components/user/reset-kyc-dialog";

interface UserKycCardProps {
  userId: string;
  username: string;
}

type BadgeVariant = "success" | "danger" | "warning" | "info" | "muted";

/** The Wirex card onboarding sends two nudges per stall: +24h and +3 days. */
const ONBOARDING_REMINDER_COUNT = 2;

/** How each KYC status reads, and how loud it should be. */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  approved: "success",
  rejected: "danger",
  under_review: "warning",
  incomplete: "warning",
  awaiting_questionnaire: "warning",
  awaiting_ubo: "warning",
  paused: "muted",
  offboarded: "muted",
  not_started: "muted",
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
      {hint && <p className="mt-0.5 break-words text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** "not_started" -> "Not started", so the card reads as prose not as a column. */
function humanize(value: string | null): string {
  if (!value) return "—";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Where a user's identity verification stands, why the provider decided that,
 * and the one action support can take on it.
 *
 * The reason codes are the point. A declined applicant reaches support with
 * "my KYC failed" and nothing else; this puts the provider's own codes —
 * `POA_MAX_ATTEMPTS_EXCEEDED`, `COMPROMISED_PERSONS` — in front of the agent
 * before they decide whether reopening is the right answer or whether the
 * decision is one we should not be undoing at all.
 */
export default function UserKycCard({ userId, username }: UserKycCardProps) {
  const { data, isLoading } = useQuery<KycResetEligibility>({
    queryKey: ["user-kyc-reset-eligibility", userId],
    queryFn: async () => (await getKycResetEligibility(userId)).data.data,
  });

  const statusVariant: BadgeVariant = data?.kycStatus
    ? (STATUS_VARIANTS[data.kycStatus] ?? "muted")
    : "muted";

  const StatusIcon =
    data?.kycStatus === "approved"
      ? ShieldCheck
      : data?.kycStatus === "rejected"
        ? ShieldAlert
        : ShieldQuestion;

  return (
    <Card className="@container">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <StatusIcon className="h-4 w-4 text-gray-500" />
          Identity verification
        </CardTitle>
        {data && <ResetKycDialog userId={userId} username={username} eligibility={data} />}
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading verification status…
          </div>
        )}

        {!isLoading && !data && (
          <p className="text-sm text-gray-500">
            Could not load verification status.
          </p>
        )}

        {data && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @lg:grid-cols-4">
              <Stat
                label="Status"
                value={
                  <Badge variant={statusVariant}>
                    {humanize(data.kycStatus)}
                  </Badge>
                }
              />
              <Stat
                label="KYC provider"
                value={humanize(data.kycProvider)}
                hint="Who ran the identity check"
              />
              <Stat
                label="Card issuer"
                value={humanize(data.cardProvider)}
                hint="Who adjudicates the card"
              />
              <Stat
                label="Provider decision"
                value={humanize(
                  data.diditVerificationStatus ??
                    data.rainApplicationStatus ??
                    data.rejectType,
                )}
                hint={data.rejectType ? `Reject type: ${data.rejectType}` : undefined}
              />
            </dl>

            {(data.sumsubReviewStatus || data.onboardingReminders) && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @lg:grid-cols-4">
                <Stat
                  label="Sumsub review"
                  value={humanize(data.sumsubReviewStatus ?? null)}
                  hint={
                    data.sumsubReviewStatus === "init"
                      ? "Opened the check, not submitted"
                      : undefined
                  }
                />
                <Stat
                  label="Onboarding nudges"
                  value={
                    data.onboardingReminders
                      ? `${data.onboardingReminders.sent} of ${ONBOARDING_REMINDER_COUNT} sent`
                      : "—"
                  }
                  hint={
                    data.onboardingReminders
                      ? `Pushes at +24h and +3 days, counted from ${formatDateTime(
                          data.onboardingReminders.anchoredAt,
                        )}`
                      : undefined
                  }
                />
              </dl>
            )}

            {data.reasonCodes.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Reason codes
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.reasonCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-900 ring-1 ring-gray-200"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* An approved verification carries no provider codes, so this is
                the only thing that says why the user is stuck. */}
            {data.forwardFailureReason && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">Could not be sent to the card issuer</p>
                <p className="mt-1 break-words">{data.forwardFailureReason}</p>
                {data.requiresNewVerification && (
                  <p className="mt-1">
                    Retrying the hand-off sends the same answers and fails the
                    same way. The user has to verify again: they can start it
                    from the app, or reset their verification here.
                  </p>
                )}
              </div>
            )}

            {!data.eligible && data.blockerMessage && (
              <p className="text-xs text-gray-500">{data.blockerMessage}</p>
            )}

            {data.eligible && data.providerDecisionIsFinal && (
              <p className="text-xs text-amber-700">
                The provider marked this decision final. A reset reopens our side
                only — clear it with the provider too, or the next attempt is
                declined the same way.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
