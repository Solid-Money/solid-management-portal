"use client";

import { Smartphone, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  campaignType,
  groupDestinations,
  type VariantDraft,
  variantProblem,
} from "@/lib/push-campaigns";
import type {
  PushCampaignDestinations,
  PushCampaignVariantKey,
} from "@/types/push-campaigns";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50";

interface VariantCardProps {
  variantKey: PushCampaignVariantKey;
  draft: VariantDraft;
  config: PushCampaignDestinations;
  /** The campaign's slug so far, to show the label this variant's pushes carry. */
  slug: string;
  /** Whether more than one variant is being sent (an A/B test). */
  isTest: boolean;
  disabled: boolean;
  onChange: (next: VariantDraft) => void;
  /** Absent for the first variant, which a campaign always has. */
  onRemove?: () => void;
}

/** One variant: its copy, where it opens, and how it will look. */
export function VariantCard({
  variantKey,
  draft,
  config,
  slug,
  isTest,
  disabled,
  onChange,
  onRemove,
}: VariantCardProps) {
  const { destinations, whatsNew, limits } = config;
  const destination = destinations.find((d) => d.id === draft.destinationId);
  const problem = variantProblem(draft, destinations, whatsNew, limits);
  const id = (field: string) => `variant-${variantKey}-${field}`;
  const set = (patch: Partial<VariantDraft>) => onChange({ ...draft, ...patch });

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1.5">
          <CardTitle>
            {isTest ? `Variant ${variantKey.toUpperCase()}` : "Message"}
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            {slug ? campaignType(slug, variantKey) : "campaign-…"}
          </CardDescription>
        </div>
        {onRemove ? (
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              disabled={disabled}
              aria-label={`Remove variant ${variantKey.toUpperCase()}`}
            >
              <Trash2 />
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={id("title")}>Title</Label>
              <span className="text-xs text-gray-400 tabular-nums">
                {draft.title.trim().length}/{limits.titleMaxLength}
              </span>
            </div>
            <Input
              id={id("title")}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              maxLength={limits.titleMaxLength}
              placeholder="Your euros can earn now"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={id("body")}>Text (optional)</Label>
              <span className="text-xs text-gray-400 tabular-nums">
                {draft.body.trim().length}/{limits.bodyMaxLength}
              </span>
            </div>
            <Textarea
              id={id("body")}
              value={draft.body}
              onChange={(e) => set({ body: e.target.value })}
              maxLength={limits.bodyMaxLength}
              placeholder="Put them in Euro yield and watch them grow."
              className="min-h-20"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={id("destination")}>Opens</Label>
            <select
              id={id("destination")}
              value={draft.destinationId}
              onChange={(e) =>
                set({
                  destinationId: e.target.value,
                  whatsNewStep: "",
                  whatsNewId: "",
                })
              }
              className={SELECT_CLASS}
              disabled={disabled}
            >
              <option value="">Choose a screen…</option>
              {groupDestinations(destinations).map(({ group, items }) => (
                <optgroup key={group} label={group}>
                  {items.map((d) => (
                    <option
                      key={d.id}
                      value={d.id}
                      disabled={!!d.needsWhatsNewStep && !whatsNew}
                    >
                      {d.label}
                      {d.needsWhatsNewStep && !whatsNew
                        ? " (no active announcement)"
                        : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {destination ? (
              <div className="flex flex-wrap items-start gap-2 text-xs text-gray-500">
                <span>{destination.description}</span>
                {destination.needsNewApp ? (
                  <Badge variant="warning">
                    Older app builds open Home instead
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          {destination?.needsWhatsNewStep && whatsNew ? (
            <div className="space-y-2">
              <Label htmlFor={id("whats-new-step")}>What&apos;s New page</Label>
              <select
                id={id("whats-new-step")}
                value={
                  draft.whatsNewId === whatsNew.id ? draft.whatsNewStep : ""
                }
                onChange={(e) =>
                  set({ whatsNewStep: e.target.value, whatsNewId: whatsNew.id })
                }
                className={SELECT_CLASS}
                disabled={disabled}
              >
                <option value="">Choose a page…</option>
                {whatsNew.steps.map((step) => (
                  <option key={step.index} value={String(step.index)}>
                    {step.index + 1}. {step.title || "Untitled page"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                The popup opens on this page instead of its first. If the
                announcement is replaced before someone taps, they get the new
                one from its first page.
              </p>
            </div>
          ) : null}

          {problem ? (
            <p className="text-xs text-amber-700">{problem}</p>
          ) : null}
        </div>

        <NotificationPreview title={draft.title} body={draft.body} />
      </CardContent>
    </Card>
  );
}

/** Roughly how the push reads on a lock screen. */
function NotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Smartphone className="h-3 w-3" />
        Preview
      </span>
      <div className="rounded-2xl bg-gray-100 p-3">
        <div className="rounded-xl bg-white/90 p-3 shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-4 w-4 rounded bg-gray-900" />
              Solid
            </span>
            <span>now</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900">
            {title.trim() || "Title"}
          </p>
          {body.trim() ? (
            <p className="line-clamp-4 text-sm text-gray-700">{body.trim()}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
