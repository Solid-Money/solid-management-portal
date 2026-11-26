"use client";

import { History, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePushCampaigns } from "@/hooks/use-push-campaigns";
import {
  describeFilters,
  formatLocalSendAt,
  formatUtcSendAt,
} from "@/lib/push-campaigns";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type {
  PushCampaignStatus,
  PushCampaignSummary,
  PushDestination,
} from "@/types/push-campaigns";

const count = (n: number) => formatNumber(n, 0, 0);

const STATUS: Record<
  PushCampaignStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "muted" }
> = {
  scheduled: { label: "Scheduled", variant: "info" },
  sent: { label: "Sent", variant: "success" },
  sending: { label: "Sending", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

interface CampaignHistoryProps {
  destinations: readonly PushDestination[];
}

/**
 * Campaigns sent (or failed, or called off) so far, their groups, and where to
 * read their results. Campaigns still to go out are on the Scheduled tab.
 */
export function CampaignHistory({ destinations }: CampaignHistoryProps) {
  const { data: all, isLoading, error } = usePushCampaigns();
  const data = all?.filter((c) => c.status !== "scheduled");
  const label = (id: string) =>
    destinations.find((d) => d.id === id)?.label ?? id;
  const campaignName = (id: string) =>
    all?.find((c) => c.id === id)?.name ?? id;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-600">Failed to load campaigns.</p>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border bg-white py-16 text-center">
        <History className="h-10 w-10 text-gray-300" />
        <p className="text-gray-500">No campaigns sent yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MeasuringNote />
      {data.map((campaign) => (
        <CampaignRow
          key={campaign.id}
          campaign={campaign}
          label={label}
          campaignName={campaignName}
        />
      ))}
    </div>
  );
}

/** One campaign: its status, when, who, and its groups. */
export function CampaignRow({
  campaign,
  label,
  campaignName,
  actions,
}: {
  campaign: PushCampaignSummary;
  label: (destinationId: string) => string;
  /** A campaign's name by id, for the control groups it leaves out. */
  campaignName: (id: string) => string;
  /** Buttons for a campaign that can still be changed. */
  actions?: React.ReactNode;
}) {
  const status = STATUS[campaign.status] ?? STATUS.failed;
  const isTest = campaign.variants.length > 1;
  const isScheduled = campaign.status === "scheduled";
  const filters = describeFilters(campaign.audienceFilters, campaignName);
  const excluded = campaign.excluded;
  const leftOut = excluded
    ? excluded.tier + excluded.control + excluded.tierUnknown
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1.5">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {campaign.name}
            <Badge variant={status.variant}>{status.label}</Badge>
            {isTest ? (
              <Badge variant="info">A/B · {campaign.variants.length} variants</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {campaign.sendAt && (isScheduled || !campaign.sentAt)
              ? `${isScheduled ? "Goes out" : "Was due"} ${formatLocalSendAt(campaign.sendAt)} (${formatUtcSendAt(campaign.sendAt)})`
              : formatDateTime(campaign.sentAt ?? campaign.createdAt)}
            {campaign.sendAt && campaign.sentAt ? " · scheduled" : ""} ·{" "}
            {campaign.updatedBy ?? campaign.createdBy}
            {campaign.reason ? ` · ${campaign.reason}` : ""}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 font-mono text-xs text-gray-500">
            {campaign.slug}
            <CopyButton value={campaign.slug} />
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isScheduled ? (
          <p className="text-xs text-gray-500">
            {count(campaign.requested)} uploaded. Who of them gets it, and the
            split below, is decided when it goes out.
          </p>
        ) : campaign.status === "cancelled" ? (
          <p className="text-xs text-gray-500">
            Cancelled
            {campaign.cancelledAt
              ? ` ${formatDateTime(campaign.cancelledAt)}`
              : ""}
            {campaign.cancelledBy ? ` by ${campaign.cancelledBy}` : ""}. Nothing
            was sent.
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            {count(campaign.requested)} uploaded · {count(campaign.reachable)}{" "}
            reachable · {count(campaign.unreachable)} without a push device ·{" "}
            {count(campaign.notFound)} not an open account
            {excluded && leftOut > 0
              ? ` · left out: ${count(excluded.tier)} by tier, ${count(excluded.control)} in an earlier control group${excluded.tierUnknown > 0 ? `, ${count(excluded.tierUnknown)} tier unreadable` : ""}`
              : ""}
          </p>
        )}
        {filters ? (
          <p className="text-xs text-gray-500">Audience: {filters}.</p>
        ) : null}
        {campaign.error ? (
          <p className="text-xs text-red-600">
            Stopped: {campaign.error}
            {campaign.variants.some((v) => v.handedOff > 0)
              ? " Groups already sent to stay sent; the rest got nothing."
              : ""}
          </p>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Opens</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Handed off</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaign.variants.map((variant) => (
              <TableRow key={variant.key}>
                <TableCell>
                  <div className="font-medium">
                    {isTest ? `Variant ${variant.key.toUpperCase()}` : "Message"}
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-gray-400">
                    {variant.type}
                    <CopyButton value={variant.type} />
                  </div>
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal">
                  <div>{variant.title}</div>
                  {variant.body ? (
                    <div className="text-xs text-gray-500">{variant.body}</div>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal">
                  {typeof variant.whatsNewStep === "number"
                    ? `What's New, page ${variant.whatsNewStep + 1}`
                    : label(variant.destinationId)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isScheduled ? "—" : count(variant.recipients)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isScheduled ? "—" : count(variant.handedOff)}
                </TableCell>
              </TableRow>
            ))}
            {campaign.controlCount > 0 ||
            (isScheduled && campaign.controlPercent > 0) ? (
              <TableRow>
                <TableCell className="font-medium">
                  Control ({campaign.controlPercent}%)
                </TableCell>
                <TableCell className="text-gray-400" colSpan={2}>
                  No push
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isScheduled ? "—" : count(campaign.controlCount)}
                </TableCell>
                <TableCell className="text-right text-gray-400">—</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Where a campaign's results are read, so nobody has to ask. */
function MeasuringNote() {
  return (
    <Card>
      <CardContent className="grid gap-4 text-sm text-gray-600 md:grid-cols-3">
        <div>
          <p className="font-medium text-gray-900">Deposits per group</p>
          <p className="mt-1 text-xs">
            Amplitude: <span className="font-mono">push_campaign_assigned</span>{" "}
            where <span className="font-mono">campaign_slug</span> is the
            campaign, grouped by <span className="font-mono">variant</span>{" "}
            (a, b, c, control). Use it as the first step of a funnel into your
            deposit event — it counts everyone assigned, so the control group is
            the baseline.
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">Opens per variant</p>
          <p className="mt-1 text-xs">
            Amplitude: <span className="font-mono">push_notification_opened</span>{" "}
            where <span className="font-mono">notification_type</span> is the
            variant&apos;s label (<span className="font-mono">campaign-…-a</span>
            ).
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">Sends and deliveries</p>
          <p className="mt-1 text-xs">
            Firebase console → Messaging → Reports, filtered by the same
            analytics label. Test sends are labelled{" "}
            <span className="font-mono">campaign-test</span> and never count.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
