"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Loader2 } from "lucide-react";

import { getUserRainSunset } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { UserRainSunsetState } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserRainSunsetCardProps {
  userId: string;
}

type BadgeVariant = "success" | "danger" | "warning" | "info" | "muted";

/** How each Sumsub/Wirex KYC status reads on the move. */
const KYC_VARIANTS: Record<string, BadgeVariant> = {
  approved: "success",
  rejected: "danger",
  under_review: "warning",
  incomplete: "warning",
  awaiting_questionnaire: "warning",
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

/** "under_review" -> "Under review". */
function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Where the user is in the Rain sunset, as one label. */
function stageOf(data: UserRainSunsetState): {
  label: string;
  variant: BadgeVariant;
} {
  if (data.retired) return { label: "Moved to Wirex", variant: "success" };
  if (data.migration) {
    return data.migration.kycStatus === "approved"
      ? { label: "Verified, no Wirex card yet", variant: "info" }
      : { label: "Moving to Wirex", variant: "warning" };
  }
  if (data.canMigrate) return { label: "Can move to Wirex", variant: "info" };
  return { label: "No Wirex option", variant: "muted" };
}

/**
 * Rain sunset for one user: whether the closing affects them, whether they
 * can move to Wirex, and how far their move got.
 *
 * The question support gets is "my card is closing — what do I do?", and the
 * answer depends on things the user cannot see: whether Wirex serves the
 * country we have on file, whether their Sumsub check is with Sumsub or with
 * Wirex, and — once they have a Wirex card — whether Rain actually confirmed
 * cancelling the old one.
 */
export default function UserRainSunsetCard({ userId }: UserRainSunsetCardProps) {
  const { data, isLoading } = useQuery<UserRainSunsetState>({
    queryKey: ["user-rain-sunset", userId],
    queryFn: async () => (await getUserRainSunset(userId)).data.data,
  });

  // Nothing to say about a user the sunset never touched.
  if (!isLoading && data && !data.affected && !data.migration && !data.retired) {
    return null;
  }

  const stage = data ? stageOf(data) : null;

  return (
    <Card className="@container">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-gray-500" />
          Rain sunset
        </CardTitle>
        {stage && <Badge variant={stage.variant}>{stage.label}</Badge>}
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Rain sunset…
          </div>
        )}

        {!isLoading && !data && (
          <p className="text-sm text-gray-500">Could not load the Rain sunset state.</p>
        )}

        {data && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @lg:grid-cols-4">
              <Stat
                label="Rain card"
                value={data.hasRainCard ? "Held" : data.retired ? "Retired" : "None"}
              />
              <Stat
                label="Country"
                value={data.country ?? "—"}
                hint={
                  data.country
                    ? data.countryServedByWirex
                      ? "Wirex serves it"
                      : "Wirex does not serve it"
                    : "No country on file"
                }
              />
              <Stat
                label="Can move"
                value={data.canMigrate ? "Yes" : "No"}
                hint={data.hasWirexCard ? "Already holds a Wirex card" : undefined}
              />
              <Stat
                label="Moved on"
                value={data.retiredAt ? formatDateTime(data.retiredAt) : "—"}
              />
            </dl>

            {data.migration && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @lg:grid-cols-4">
                <Stat
                  label="Wirex check"
                  value={
                    <Badge
                      variant={
                        KYC_VARIANTS[data.migration.kycStatus ?? ""] ?? "muted"
                      }
                    >
                      {humanize(data.migration.kycStatus)}
                    </Badge>
                  }
                  hint={
                    data.migration.startedAt
                      ? `Started ${formatDateTime(data.migration.startedAt)}`
                      : undefined
                  }
                />
                <Stat
                  label="Sumsub review"
                  value={humanize(data.migration.sumsubReviewStatus)}
                  hint={data.migration.sumsubReviewAnswer ?? undefined}
                />
                <Stat
                  label="Wirex decision"
                  value={humanize(data.migration.wirexVerificationStatus)}
                />
                <Stat
                  label="Wirex user"
                  value={
                    data.migration.wirexUserId ? (
                      <span className="break-all font-mono text-xs">
                        {data.migration.wirexUserId}
                      </span>
                    ) : (
                      "Not registered"
                    )
                  }
                />
              </dl>
            )}

            {data.rainCards.length > 0 && (
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Rain card</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Retired</th>
                      <th className="px-3 py-2 font-medium">Cancelled at Rain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.rainCards.map((card) => (
                      <tr key={card.cardId}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">
                          {card.cardId}
                        </td>
                        <td className="px-3 py-2 text-xs">{humanize(card.status)}</td>
                        <td className="px-3 py-2 text-xs">
                          {card.retiredAt ? formatDateTime(card.retiredAt) : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {card.cancelledAt ? (
                            formatDateTime(card.cancelledAt)
                          ) : card.retiredAt ? (
                            <span
                              className="text-amber-700"
                              title={card.cancelError ?? undefined}
                            >
                              Pending{card.cancelError ? " (retrying)" : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
