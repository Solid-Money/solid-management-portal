"use client";

import { Send } from "lucide-react";

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
import { campaignType, type ExpectedSplit } from "@/lib/push-campaigns";
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
}

interface SendCampaignDialogProps {
  campaign: CampaignToSend | null;
  destinations: readonly PushDestination[];
  onCancel: () => void;
  onConfirm: (campaign: CampaignToSend) => void;
}

/** The last look before a campaign goes to real people. */
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
              <DialogTitle>Send “{campaign.input.name}”?</DialogTitle>
              <DialogDescription>
                {count(campaign.reachable)} people can receive it.{" "}
                {campaign.split.control > 0
                  ? `${count(campaign.split.control)} of them, picked at random, are held back as the control group and get nothing. `
                  : ""}
                This cannot be recalled once sent.
              </DialogDescription>
            </DialogHeader>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Opens</TableHead>
                  <TableHead className="text-right">People</TableHead>
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
                <Send />
                Send to {count(campaign.split.arms.reduce((a, b) => a + b, 0))}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
