"use client";

import { Filter } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TIER_LABELS, type FiltersDraft } from "@/lib/push-campaigns";
import { formatDateTime } from "@/lib/utils";
import type {
  PushCampaignSummary,
  PushCampaignTier,
} from "@/types/push-campaigns";

interface AudienceFiltersCardProps {
  filters: FiltersDraft;
  onChange: (filters: FiltersDraft) => void;
  tiers: readonly PushCampaignTier[];
  /** Earlier campaigns with a control group to leave out. */
  controlSources: readonly PushCampaignSummary[];
  maxExcludedControls: number;
  disabled: boolean;
}

/**
 * Who of the list is left out when the campaign goes out — read at that
 * moment, so a push scheduled for Monday leaves out whoever upgraded over the
 * weekend, and a multi-day flow can keep one clean control group.
 */
export function AudienceFiltersCard({
  filters,
  onChange,
  tiers,
  controlSources,
  maxExcludedControls,
  disabled,
}: AudienceFiltersCardProps) {
  const toggleTier = (tier: PushCampaignTier, on: boolean) =>
    onChange({
      ...filters,
      tiers: on
        ? tiers.filter((t) => t === tier || filters.tiers.includes(t))
        : filters.tiers.filter((t) => t !== tier),
    });
  const toggleControl = (id: string, on: boolean) =>
    onChange({
      ...filters,
      excludeControlOf: on
        ? [...filters.excludeControlOf, id]
        : filters.excludeControlOf.filter((x) => x !== id),
    });
  const narrowsTier =
    filters.tiers.length > 0 && filters.tiers.length < tiers.length;
  const atMax = filters.excludeControlOf.length >= maxExcludedControls;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            Leave out when it goes out
          </CardTitle>
          <CardDescription>
            Checked at send time, not now: someone who upgrades between now and
            then is left out of a push asking them to upgrade.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">
            Only send to people whose tier then is
          </p>
          <div className="flex flex-wrap gap-4">
            {tiers.map((tier) => (
              <div key={tier} className="flex items-center gap-2">
                <Checkbox
                  id={`push-tier-${tier}`}
                  checked={filters.tiers.includes(tier)}
                  onCheckedChange={(checked) =>
                    toggleTier(tier, checked === true)
                  }
                  disabled={disabled}
                />
                <Label htmlFor={`push-tier-${tier}`}>{TIER_LABELS[tier]}</Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {narrowsTier
              ? "Anyone else, and anyone whose tier can't be read at that moment, gets nothing."
              : "None or all ticked: every tier."}
          </p>
          {narrowsTier ? (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="push-ignore-trials"
                checked={filters.ignoreTrials}
                onCheckedChange={(checked) =>
                  onChange({ ...filters, ignoreTrials: checked === true })
                }
                disabled={disabled}
              />
              <Label htmlFor="push-ignore-trials" className="font-normal">
                Count someone on a free trial by the tier they paid for (a Prime
                trial counts as Core)
              </Label>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">
            Leave out the control group of
          </p>
          {controlSources.length === 0 ? (
            <p className="text-xs text-gray-500">
              No earlier campaign held a control group back.
            </p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {controlSources.map((campaign) => {
                const checked = filters.excludeControlOf.includes(campaign.id);
                return (
                  <div key={campaign.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`push-exclude-${campaign.id}`}
                      checked={checked}
                      onCheckedChange={(on) =>
                        toggleControl(campaign.id, on === true)
                      }
                      disabled={disabled || (!checked && atMax)}
                    />
                    <Label
                      htmlFor={`push-exclude-${campaign.id}`}
                      className="font-normal leading-snug"
                    >
                      {campaign.name}
                      <span className="text-xs text-gray-500">
                        {" "}
                        ·{" "}
                        {campaign.status === "scheduled"
                          ? `scheduled ${formatDateTime(campaign.sendAt ?? campaign.createdAt)}`
                          : formatDateTime(campaign.sentAt ?? campaign.createdAt)}{" "}
                        · {campaign.controlPercent}% control
                      </span>
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-500">
            Keeps the holdout of a flow clean: people held back from the first
            push stay out of the follow-ups. At most {maxExcludedControls}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
