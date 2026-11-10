"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { AudienceCard } from "@/components/push-campaigns/audience-card";
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
  useSendPushCampaign,
  useSendPushCampaignTest,
} from "@/hooks/use-push-campaigns";
import {
  campaignSlug,
  emptyVariant,
  expectedSplit,
  parseAudience,
  parseTestRecipients,
  sameIds,
  toVariantInput,
  VARIANT_KEYS,
  type VariantDraft,
  variantProblem,
} from "@/lib/push-campaigns";
import { formatNumber } from "@/lib/utils";
import type {
  PushCampaignDestinations,
  PushCampaignPreview,
  PushCampaignSummary,
  PushCampaignTestResult,
} from "@/types/push-campaigns";

const count = (n: number) => formatNumber(n, 0, 0);
const NAME_MIN_LENGTH = 3;
const DEFAULT_CONTROL_PERCENT = "10";

interface PushCampaignComposerProps {
  config: PushCampaignDestinations;
  /** Called with the campaign once it has been sent. */
  onSent: (campaign: PushCampaignSummary) => void;
}

/**
 * The compose tab: audience, one to three variants, an optional control group,
 * a test send, then the send itself.
 *
 * The send is bound to the audience as it was last checked, not to whatever
 * the text box holds now, and the confirm dialog freezes the whole payload
 * when it opens — so what is confirmed is exactly what goes out.
 */
export function PushCampaignComposer({
  config,
  onSent,
}: PushCampaignComposerProps) {
  const { destinations, whatsNew, limits, canSend } = config;

  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [controlOn, setControlOn] = useState(false);
  const [controlPercent, setControlPercent] = useState(DEFAULT_CONTROL_PERCENT);
  const [testRecipients, setTestRecipients] = useState("");
  const [testResult, setTestResult] = useState<PushCampaignTestResult | null>(
    null,
  );
  // The ids and result of the last audience check. Sending uses these ids.
  const [checked, setChecked] = useState<{
    ids: string[];
    preview: PushCampaignPreview;
  } | null>(null);
  const [confirming, setConfirming] = useState<CampaignToSend | null>(null);

  const previewAudience = usePreviewPushAudience();
  const sendTest = useSendPushCampaignTest();
  const send = useSendPushCampaign();
  const busy = previewAudience.isPending || send.isPending;

  const parsed = useMemo(() => parseAudience(raw), [raw]);
  const slug = campaignSlug(name);
  const checkedMatches = !!checked && sameIds(checked.ids, parsed.ids);

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

  const sendBlocker = !canSend
    ? "You can prepare a campaign, but sending is limited to named admins."
    : !nameValid
      ? `Name the campaign (${NAME_MIN_LENGTH}–${limits.nameMaxLength} characters, with letters or digits).`
      : !variantsReady
        ? "Finish every variant."
        : !percentValid
          ? `The control group is 1–${limits.maxControlPercent}% of the audience.`
          : !checked
            ? "Check the audience first."
            : !checkedMatches
              ? "The list changed since it was checked. Check it again."
              : !groupsFilled
                ? `Only ${count(reachable)} people can receive a push: too few for ${variants.length > 1 ? "every variant" : "this campaign"}${controlOn ? " and a control group" : ""}.`
                : null;

  const testList = parseTestRecipients(testRecipients);
  const testBlocker = !canSend
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
    previewAudience.mutate(ids, {
      onSuccess: (preview) => setChecked({ ids, preview }),
    });
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
      },
      slug,
      reachable,
      split,
    });
  };

  const confirmSend = (campaign: CampaignToSend) => {
    setConfirming(null);
    send.mutate(campaign.input, {
      onSuccess: (sent) => {
        const handedOff = sent.variants.reduce((n, v) => n + v.handedOff, 0);
        toast.success(`“${sent.name}” sent to ${count(handedOff)} people`);
        // Start the next one clean: a sent audience left checked is one
        // rename away from being pushed twice.
        setRaw("");
        setChecked(null);
        setName("");
        setReason("");
        setTestResult(null);
        onSent(sent);
      },
    });
  };

  const updateVariant = (index: number, next: VariantDraft) =>
    setVariants((current) => current.map((v, i) => (i === index ? next : v)));

  return (
    <div className="space-y-6">
      <AudienceCard
        raw={raw}
        onRawChange={setRaw}
        parsed={parsed}
        maxRecipients={limits.maxRecipients}
        preview={checked?.preview ?? null}
        previewStale={!!checked && !checkedMatches}
        isPreviewing={previewAudience.isPending}
        disabled={send.isPending}
        onPreview={runPreview}
      />

      <div className="space-y-4">
        {variants.map((draft, index) => (
          <VariantCard
            key={VARIANT_KEYS[index]}
            variantKey={VARIANT_KEYS[index]}
            draft={draft}
            config={config}
            slug={slug}
            isTest={variants.length > 1}
            disabled={send.isPending}
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
            disabled={send.isPending}
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
            disabled={send.isPending}
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
                  disabled={send.isPending}
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
              placeholder="mark, 6ac4df9322b1a60a4458ab80"
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
              <Send className="h-4 w-4 text-gray-400" />
              Send
            </CardTitle>
            <CardDescription>
              The name labels every push and analytics event of the campaign,
              so it can be found later. A name can be sent once.
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
                disabled={send.isPending}
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
                disabled={send.isPending}
              />
            </div>
          </div>

          {checkedMatches && groupsFilled ? (
            <p className="text-sm text-gray-600">
              {variants.length > 1
                ? `${split.arms.map((n, i) => `${VARIANT_KEYS[i].toUpperCase()}: ${count(n)}`).join(" · ")}`
                : `${count(split.arms[0])} people`}
              {split.control > 0 ? ` · control: ${count(split.control)}` : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={openConfirm}
              disabled={!!sendBlocker || busy}
            >
              {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              {send.isPending ? "Sending…" : "Review and send"}
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
