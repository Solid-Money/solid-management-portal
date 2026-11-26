"use client";

import { CalendarClock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  campaignType,
  formatLocalSendAt,
  formatUtcSendAt,
  localTimeZoneLabel,
  type ExpectedSplit,
} from "@/lib/push-campaigns";
import { formatNumber } from "@/lib/utils";
import type {
  PushDestination,
  SendPushCampaignInput,
} from "@/types/push-campaigns";

const count = (n: number) => formatNumber(n, 0, 0);

/** What the dialog confirms, frozen when it opened. */
export interface CampaignToSend {
  input: SendPushCampaignInput;
  slug: string;
  reachable: number;
  split: ExpectedSplit;
  /** When set, the campaign is scheduled for this instant (ISO) instead of sent now. */
  sendAt?: string;
  /** The scheduled campaign this saves changes to. */
  editingId?: string;
}

interface SendCampaignDialogProps {
  campaign: CampaignToSend | null;
  destinations: readonly PushDestination[];
  onCancel: () => void;
  onConfirm: (campaign: CampaignToSend) => void;
}

/**
 * The last look before a campaign goes to real people, now or at the time it
 * is scheduled for.
 */
export function SendCampaignDialog({
  campaign,
  destinations,
  onCancel,
  onConfirm,
}: SendCampaignDialogProps) {
  const label = (id: string) =>
    destinations.find((d) => d.id === id)?.label ?? id;

  return (
    <Dialog open={!!campaign} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-3xl">
        {campaign ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {campaign.editingId
                  ? `Save the changes to “${campaign.input.name}”?`
                  : campaign.sendAt
                    ? `Schedule “${campaign.input.name}”?`
                    : `Send “${campaign.input.name}”?`}
              </DialogTitle>
              <DialogDescription>
                {campaign.sendAt ? (
                  <>
                    Goes out{" "}
                    <span className="font-medium text-gray-900">
                      {formatLocalSendAt(campaign.sendAt)}
                    </span>{" "}
                    {localTimeZoneLabel(new Date(campaign.sendAt))} (
                    {formatUtcSendAt(campaign.sendAt)}). Who it reaches is
                    checked then: as of now {count(campaign.reachable)} people
                    can receive it, split as below. It can be changed or
                    cancelled until it goes out.
                  </>
                ) : (
                  <>
                    {count(campaign.reachable)} people can receive it.{" "}
                    {campaign.split.control > 0
                      ? `${count(campaign.split.control)} of them, picked at random, are held back as the control group and get nothing. `
                      : ""}
                    This cannot be recalled once sent.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Opens</TableHead>
                  <TableHead className="text-right">
                    {campaign.sendAt ? "People, as of now" : "People"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.input.variants.map((variant, index) => {
                  const key = (["a", "b", "c"] as const)[index];
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div className="font-medium">
                          {campaign.input.variants.length > 1
                            ? `Variant ${key.toUpperCase()}`
                            : "Message"}
                        </div>
                        <div className="font-mono text-[11px] text-gray-400">
                          {campaignType(campaign.slug, key)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48 whitespace-normal">
                        {variant.title}
                      </TableCell>
                      <TableCell className="max-w-56 whitespace-normal">
                        {variant.whatsNewStep !== undefined
                          ? `What's New, page ${variant.whatsNewStep + 1}`
                          : label(variant.destinationId)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {count(campaign.split.arms[index] ?? 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {campaign.split.control > 0 ? (
                  <TableRow>
                    <TableCell className="font-medium">Control</TableCell>
                    <TableCell className="text-gray-400" colSpan={2}>
                      No push — the baseline the variants are measured against
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {count(campaign.split.control)}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => onConfirm(campaign)}>
                {campaign.sendAt ? <CalendarClock /> : <Send />}
                {campaign.editingId
                  ? "Save changes"
                  : campaign.sendAt
                    ? "Schedule"
                    : `Send to ${count(campaign.split.arms.reduce((a, b) => a + b, 0))}`}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
