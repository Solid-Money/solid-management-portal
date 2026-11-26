"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  FlaskConical,
  Loader2,
  Plus,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AudienceCard } from "@/components/push-campaigns/audience-card";
import { AudienceFiltersCard } from "@/components/push-campaigns/audience-filters-card";
import {
  type CampaignToSend,
  SendCampaignDialog,
} from "@/components/push-campaigns/send-campaign-dialog";
import { VariantCard } from "@/components/push-campaigns/variant-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  usePreviewPushAudience,
  usePushCampaigns,
  useSchedulePushCampaign,
  useSendPushCampaign,
  useSendPushCampaignTest,
} from "@/hooks/use-push-campaigns";
import {
  campaignSlug,
  type ComposerSeed,
  controlGroupSources,
  defaultSendAt,
  emptyFilters,
  emptyVariant,
  expectedSplit,
  type FiltersDraft,
  formatLocalSendAt,
  formatUtcSendAt,
  localTimeZoneLabel,
  parseAudience,
  parseTestRecipients,
  sameFilters,
  sameIds,
  sendAtInstant,
  sendTimeProblem,
  toFiltersInput,
  toVariantInput,
  VARIANT_KEYS,
  type VariantDraft,
  variantProblem,
} from "@/lib/push-campaigns";
import { formatNumber } from "@/lib/utils";
import type {
  PushCampaignAudienceFilters,
  PushCampaignDestinations,
  PushCampaignPreview,
  PushCampaignSummary,
  PushCampaignTestResult,
} from "@/types/push-campaigns";

const count = (n: number) => formatNumber(n, 0, 0);
const NAME_MIN_LENGTH = 3;
const DEFAULT_CONTROL_PERCENT = "10";
const DEFAULT_MAX_EXCLUDED_CONTROLS = 5;

interface PushCampaignComposerProps {
  config: PushCampaignDestinations;
  /**
   * The settings could not be refreshed. Nothing is sent until they are:
   * `config` may describe a What's New or an allowlist that has since changed.
   */
  settingsStale?: boolean;
  /** A scheduled campaign being edited, and the state it starts from. */
  editing?: { id: string; name: string; seed: ComposerSeed };
  /** Called with the campaign once it has been sent. */
  onSent: (campaign: PushCampaignSummary) => void;
  /** Called with the campaign once it has been scheduled or its changes saved. */
  onScheduled: (campaign: PushCampaignSummary) => void;
  /** Leave the edit without saving. */
  onCancelEdit?: () => void;
}

/**
 * The compose tab: audience, who to leave out when it goes out, one to three
 * variants, an optional control group, a test send, then the send itself —
 * now, or at a time it is scheduled for.
 *
 * The send is bound to the audience as it was last checked, not to whatever
 * the text box holds now, and the confirm dialog freezes the whole payload
 * when it opens — so what is confirmed is exactly what goes out. A scheduled
 * campaign is checked again by the server when it goes out.
 */
export function PushCampaignComposer({
  config,
  settingsStale = false,
  editing,
  onSent,
  onScheduled,
  onCancelEdit,
}: PushCampaignComposerProps) {
  const { destinations, whatsNew, limits, canSend } = config;
  const tiers = useMemo(() => config.tiers ?? [], [config.tiers]);
  // Backends from before scheduling report neither.
  const canSchedule = config.schedulerEnabled !== undefined;
  const seed = editing?.seed;

  const [raw, setRaw] = useState(seed?.raw ?? "");
  const [name, setName] = useState(seed?.name ?? "");
  const [reason, setReason] = useState(seed?.reason ?? "");
  const [variants, setVariants] = useState<VariantDraft[]>(
    seed?.variants.length ? seed.variants : [emptyVariant()],
  );
  const [controlOn, setControlOn] = useState(seed?.controlOn ?? false);
  const [controlPercent, setControlPercent] = useState(
    seed?.controlPercent ?? DEFAULT_CONTROL_PERCENT,
  );
  const [filters, setFilters] = useState<FiltersDraft>(
    seed?.filters ?? emptyFilters(),
  );
  const [scheduleOn, setScheduleOn] = useState(!!editing);
  const [sendAt, setSendAt] = useState(seed?.sendAt || defaultSendAt());
  const [testRecipients, setTestRecipients] = useState("");
  const [testResult, setTestResult] = useState<PushCampaignTestResult | null>(
    null,
  );
  // The ids, filters and result of the last audience check. Sending uses these ids.
  const [checked, setChecked] = useState<{
    ids: string[];
    filters?: PushCampaignAudienceFilters;
    preview: PushCampaignPreview;
  } | null>(null);
  const [confirming, setConfirming] = useState<CampaignToSend | null>(null);

  const { data: campaigns } = usePushCampaigns();
  const previewAudience = usePreviewPushAudience();
  const sendTest = useSendPushCampaignTest();
  const send = useSendPushCampaign();
  const schedule = useSchedulePushCampaign();
  const submitting = send.isPending || schedule.isPending;
  const busy = previewAudience.isPending || submitting;

  const parsed = useMemo(() => parseAudience(raw), [raw]);
  const filtersInput = useMemo(
    () => toFiltersInput(filters, tiers),
    [filters, tiers],
  );
  const controlSources = useMemo(
    () => controlGroupSources(campaigns ?? [], editing?.id),
    [campaigns, editing?.id],
  );
  const slug = campaignSlug(name);
  const checkedMatches =
    !!checked &&
    sameIds(checked.ids, parsed.ids) &&
    sameFilters(checked.filters, filtersInput);

  const problems = variants.map((v) =>
    variantProblem(v, destinations, whatsNew, limits),
  );
  const variantsReady = problems.every((p) => p === null);
  const percent = controlOn ? Number(controlPercent) : 0;
  const percentValid =
    !controlOn ||
    (controlPercent.trim() !== "" &&
      Number.isInteger(percent) &&
      percent >= 1 &&
      percent <= limits.maxControlPercent);
  const reachable = checkedMatches ? checked.preview.reachable : 0;
  const split = expectedSplit(reachable, variants.length, percentValid ? percent : 0);
  const groupsFilled =
    split.arms.every((n) => n > 0) && (!controlOn || split.control > 0);
  const nameValid =
    name.trim().length >= NAME_MIN_LENGTH &&
    name.trim().length <= limits.nameMaxLength &&
    slug.length >= NAME_MIN_LENGTH;
  // An edit that leaves the time alone sends at the time stored, to the minute.
  const stored = seed?.storedSendAt;
  const sendAtIso = scheduleOn ? sendAtInstant(sendAt, stored) : null;
  const timeProblem = scheduleOn
    ? sendTimeProblem(sendAt, limits, new Date(), stored)
    : null;

  const staleReason =
    "Push settings couldn't be refreshed. Retry above before sending.";
  const sendBlocker = settingsStale
    ? staleReason
    : !canSend
      ? "You can prepare a campaign, but sending is limited to named admins."
      : scheduleOn && !config.schedulerEnabled
        ? "Scheduled sending is switched off on the server. Send it now instead."
        : !nameValid
          ? `Name the campaign (${NAME_MIN_LENGTH}–${limits.nameMaxLength} characters, with letters or digits).`
          : !variantsReady
            ? "Finish every variant."
            : !percentValid
              ? `The control group is 1–${limits.maxControlPercent}% of the audience.`
              : timeProblem
                ? timeProblem
                : !checked
                  ? "Check the audience first."
                  : !checkedMatches
                    ? "The list or who is left out changed since it was checked. Check it again."
                    : !groupsFilled
                      ? `Only ${count(reachable)} people can receive a push: too few for ${variants.length > 1 ? "every variant" : "this campaign"}${controlOn ? " and a control group" : ""}.`
                      : null;

  const testList = parseTestRecipients(testRecipients);
  const testBlocker = settingsStale
    ? staleReason
    : !canSend
      ? "Sending is limited to named admins."
      : !variantsReady
        ? "Finish every variant."
        : testList.length === 0
          ? "Name who should get the test."
          : testList.length > limits.maxTestRecipients
            ? `At most ${limits.maxTestRecipients} test recipients.`
            : null;

  const variantInputs = () =>
    variants.map((v) => toVariantInput(v, destinations));

  const runPreview = () => {
    const ids = parsed.ids;
    const asked = filtersInput;
    previewAudience.mutate(
      { userIds: ids, filters: asked },
      { onSuccess: (preview) => setChecked({ ids, filters: asked, preview }) },
    );
  };

  const runTest = () => {
    setTestResult(null);
    sendTest.mutate(
      { recipients: testList, variants: variantInputs() },
      {
        onSuccess: (result) => {
          setTestResult(result);
          toast.success(
            `Sent ${result.variants} test push${result.variants === 1 ? "" : "es"} to ${result.sentTo.length} user(s)`,
          );
        },
      },
    );
  };

  const openConfirm = () => {
    if (sendBlocker || !checked) return;
    setConfirming({
      input: {
        name: name.trim(),
        userIds: checked.ids,
        variants: variantInputs(),
        controlPercent: percent,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(checked.filters ? { filters: checked.filters } : {}),
      },
      slug,
      reachable,
      split,
      ...(scheduleOn && sendAtIso ? { sendAt: sendAtIso } : {}),
      ...(editing ? { editingId: editing.id } : {}),
    });
  };

  const confirmSend = (campaign: CampaignToSend) => {
    setConfirming(null);
    // The settings went stale while the dialog was open.
    if (settingsStale) {
      toast.error(staleReason);
      return;
    }
    if (campaign.sendAt) {
      const when = campaign.sendAt;
      schedule.mutate(
        { id: campaign.editingId, input: { ...campaign.input, sendAt: when } },
        {
          onSuccess: (scheduled) => {
            toast.success(
              `“${scheduled.name}” ${campaign.editingId ? "updated" : "scheduled"} for ${formatLocalSendAt(when)}`,
            );
            onScheduled(scheduled);
          },
        },
      );
      return;
    }
    send.mutate(campaign.input, {
      onSuccess: (sent) => {
        const handedOff = sent.variants.reduce((n, v) => n + v.handedOff, 0);
        toast.success(`“${sent.name}” sent to ${count(handedOff)} people`);
        // The page remounts this form, so the next campaign starts clean: a
        // sent audience left checked is one rename away from being pushed twice.
        onSent(sent);
      },
    });
  };

  const updateVariant = (index: number, next: VariantDraft) =>
    setVariants((current) => current.map((v, i) => (i === index ? next : v)));

  return (
    <div className="space-y-6">
      {editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Editing the scheduled campaign “{editing.name}”. Check the audience
            again, then save.
          </span>
          {onCancelEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              disabled={submitting}
            >
              <X />
              Stop editing
            </Button>
          ) : null}
        </div>
      ) : null}

      <AudienceCard
        raw={raw}
        onRawChange={setRaw}
        parsed={parsed}
        maxRecipients={limits.maxRecipients}
        preview={checked?.preview ?? null}
        previewStale={!!checked && !checkedMatches}
        isPreviewing={previewAudience.isPending}
        disabled={submitting}
        onPreview={runPreview}
      />

      {tiers.length > 0 ? (
        <AudienceFiltersCard
          filters={filters}
          onChange={setFilters}
          tiers={tiers}
          controlSources={controlSources}
          campaigns={campaigns ?? []}
          maxExcludedControls={
            limits.maxExcludedControls ?? DEFAULT_MAX_EXCLUDED_CONTROLS
          }
          disabled={submitting}
        />
      ) : null}

      <div className="space-y-4">
        {variants.map((draft, index) => (
          <VariantCard
            key={VARIANT_KEYS[index]}
            variantKey={VARIANT_KEYS[index]}
            draft={draft}
            config={config}
            slug={slug}
            isTest={variants.length > 1}
            disabled={submitting}
            onChange={(next) => updateVariant(index, next)}
            onRemove={
              index > 0 && index === variants.length - 1
                ? () => setVariants((current) => current.slice(0, -1))
                : undefined
            }
          />
        ))}
        {variants.length < limits.maxVariants ? (
          <Button
            variant="outline"
            onClick={() =>
              setVariants((current) => [
                ...current,
                // A new variant starts as a copy of the last, since a test
                // usually changes one thing.
                { ...current[current.length - 1] },
              ])
            }
            disabled={submitting}
          >
            <Plus />
            Add variant {VARIANT_KEYS[variants.length].toUpperCase()} (A/B test)
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle>Control group</CardTitle>
            <CardDescription>
              People held back at random and sent nothing, so a variant&apos;s
              deposits can be compared with no push at all.
            </CardDescription>
          </div>
          <Switch
            checked={controlOn}
            onCheckedChange={setControlOn}
            aria-label="Hold back a control group"
            disabled={submitting}
          />
        </CardHeader>
        {controlOn ? (
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="push-control-percent">Share of the audience</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="push-control-percent"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={limits.maxControlPercent}
                  step={1}
                  value={controlPercent}
                  onChange={(e) => setControlPercent(e.target.value)}
                  className="w-24"
                  disabled={submitting}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
            {!percentValid ? (
              <p className="text-xs text-amber-700">
                1 to {limits.maxControlPercent}%, in whole percent.
              </p>
            ) : null}
          </CardContent>
        ) : variants.length > 1 ? (
          <CardContent className="text-xs text-gray-500">
            Without a control group the test shows which variant did better,
            not whether either beat sending nothing.
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-gray-400" />
              Test send
            </CardTitle>
            <CardDescription>
              Every variant, exactly as it will go out, to a few people by
              username or user id — your own phone first. Labelled as a test,
              so it never counts towards the results.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={testRecipients}
              onChange={(e) => setTestRecipients(e.target.value)}
              placeholder="your_username, 000000000000000000000001"
              className="max-w-md"
              aria-label="Test recipients"
              disabled={sendTest.isPending}
            />
            <Button
              variant="outline"
              onClick={runTest}
              disabled={!!testBlocker || sendTest.isPending}
              title={testBlocker ?? undefined}
            >
              {sendTest.isPending ? <Loader2 className="animate-spin" /> : null}
              Send test
            </Button>
          </div>
          {testResult ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {testResult.sentTo.map((user) => (
                <Badge
                  key={user.userId}
                  variant={
                    testResult.withoutDevice.includes(user.userId)
                      ? "warning"
                      : "success"
                  }
                >
                  {user.username}
                  {testResult.withoutDevice.includes(user.userId)
                    ? " · no push device"
                    : ""}
                </Badge>
              ))}
              {testResult.unresolved.map((who) => (
                <Badge key={who} variant="danger">
                  {who} · not found
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              {scheduleOn ? (
                <CalendarClock className="h-4 w-4 text-gray-400" />
              ) : (
                <Send className="h-4 w-4 text-gray-400" />
              )}
              {scheduleOn ? "Schedule" : "Send"}
            </CardTitle>
            <CardDescription>
              The name labels every push and analytics event of the campaign,
              so it can be found later. A name can be used once.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="push-campaign-name">Campaign name</Label>
              <Input
                id="push-campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={limits.nameMaxLength}
                placeholder="Euro yield Nov"
                disabled={submitting}
              />
              <p className="font-mono text-xs text-gray-400">
                {slug || "—"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="push-campaign-reason">Why (optional)</Label>
              <Input
                id="push-campaign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Monday task: euro yield nudge for EUR holders"
                disabled={submitting}
              />
            </div>
          </div>

          {canSchedule ? (
            <div className="space-y-3 rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="push-schedule" className="font-medium">
                  Schedule for later
                </Label>
                <Switch
                  id="push-schedule"
                  checked={scheduleOn}
                  onCheckedChange={setScheduleOn}
                  // A scheduled campaign being edited stays scheduled; cancel it
                  // from the Scheduled tab to send something now instead.
                  disabled={submitting || !!editing || !config.schedulerEnabled}
                />
              </div>
              {!config.schedulerEnabled ? (
                <p className="text-xs text-gray-500">
                  Scheduled sending is switched off on the server.
                </p>
              ) : scheduleOn ? (
                <div className="space-y-2">
                  <Input
                    id="push-send-at"
                    type="datetime-local"
                    value={sendAt}
                    onChange={(e) => setSendAt(e.target.value)}
                    className="max-w-xs bg-white"
                    aria-label="Send at"
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-500">
                    Your time zone: {localTimeZoneLabel(
                      sendAtIso ? new Date(sendAtIso) : new Date(),
                    )}
                    {sendAtIso ? ` · ${formatUtcSendAt(sendAtIso)}` : ""}. Who
                    it reaches, the tier filter and the split are checked when
                    it goes out; you get a Slack message either way.
                  </p>
                  {timeProblem ? (
                    <p className="text-xs text-amber-700">{timeProblem}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {checkedMatches && groupsFilled ? (
            <p className="text-sm text-gray-600">
              {scheduleOn ? "As of now: " : ""}
              {variants.length > 1
                ? `${split.arms.map((n, i) => `${VARIANT_KEYS[i].toUpperCase()}: ${count(n)}`).join(" · ")}`
                : `${count(split.arms[0])} people`}
              {split.control > 0 ? ` · control: ${count(split.control)}` : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={openConfirm} disabled={!!sendBlocker || busy}>
              {submitting ? (
                <Loader2 className="animate-spin" />
              ) : scheduleOn ? (
                <CalendarClock />
              ) : (
                <Send />
              )}
              {submitting
                ? scheduleOn
                  ? "Saving…"
                  : "Sending…"
                : editing
                  ? "Review and save"
                  : scheduleOn
                    ? "Review and schedule"
                    : "Review and send"}
            </Button>
            {sendBlocker ? (
              <span className="text-xs text-gray-500">{sendBlocker}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <SendCampaignDialog
        campaign={confirming}
        destinations={destinations}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmSend}
      />
    </div>
  );
}
