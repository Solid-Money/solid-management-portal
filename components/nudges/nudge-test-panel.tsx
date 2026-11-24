"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSendNudgeTest } from "@/hooks/use-nudges";
import type { NudgePatch, NudgeTestChannel, NudgeView } from "@/types/nudges";

const MAX_RECIPIENTS = 5;

/**
 * Send this nudge to a few named users — by default the admin's own Solid
 * account — with the unsaved edits, so copy and templates are seen on a real
 * phone and inbox before they reach anyone else.
 */
export function NudgeTestPanel({
  nudge,
  draft,
}: {
  nudge: NudgeView;
  draft: Pick<NudgePatch, "push" | "email">;
}) {
  const id = useId();
  const channels: NudgeTestChannel[] = [
    ...(nudge.push ? (["push"] as const) : []),
    ...(nudge.email ? (["email"] as const) : []),
    ...(nudge.push && nudge.email ? (["both"] as const) : []),
  ];
  const [channel, setChannel] = useState<NudgeTestChannel>(
    channels.includes("both") ? "both" : (channels[0] ?? "push")
  );
  const [recipients, setRecipients] = useState("");
  const test = useSendNudgeTest();

  if (channels.length === 0) return null;

  const list = recipients
    .split(/[\s,;]+/)
    .map((r) => r.trim())
    .filter(Boolean);
  const tooMany = list.length > MAX_RECIPIENTS;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-channel`}>Send</Label>
          <Select
            value={channel}
            onValueChange={(next) => setChannel(next as NudgeTestChannel)}
          >
            <SelectTrigger id={`${id}-channel`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "both" ? "Push and email" : c === "push" ? "Push" : "Email"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-recipients`}>To (optional)</Label>
          <Input
            id={`${id}-recipients`}
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="User ids or emails, up to 5. Empty: your own account."
          />
          {tooMany ? (
            <p className="text-xs text-red-700">At most {MAX_RECIPIENTS}.</p>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          test.mutate({
            key: nudge.key,
            input: {
              channel,
              ...(list.length > 0 ? { recipients: list } : {}),
              ...(draft.push || draft.email ? { draft } : {}),
            },
          })
        }
        disabled={test.isPending || tooMany}
      >
        {test.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        Send test
      </Button>

      {test.data ? (
        <ul className="space-y-1 text-sm">
          {test.data.recipients.map((r) => (
            <li key={r.recipient} className="space-y-0.5">
              <span className="font-mono text-xs text-gray-700">{r.recipient}</span>
              {!r.found ? (
                <p className="text-xs text-red-700">No Solid account found.</p>
              ) : (
                <div className="flex flex-wrap gap-3 text-xs">
                  {r.push ? <Outcome label="Push" outcome={r.push} /> : null}
                  {r.email ? <Outcome label="Email" outcome={r.email} /> : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Outcome({
  label,
  outcome,
}: {
  label: string;
  outcome: { sent: boolean; reason?: string };
}) {
  return outcome.sent ? (
    <span className="flex items-center gap-1 text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      {label} sent
    </span>
  ) : (
    <span className="flex items-center gap-1 text-red-700">
      <XCircle className="h-3 w-3" />
      {label} not sent{outcome.reason ? `: ${outcome.reason}` : ""}
    </span>
  );
}
