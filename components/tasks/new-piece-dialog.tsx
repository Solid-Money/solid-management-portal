"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, Loader2, Megaphone, Rocket, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMarketing, useTaskPeople, TASK_KEYS } from "@/hooks/use-tasks";
import { createTask } from "@/lib/tasks-api";
import { launchesFor, publishLabel } from "@/lib/task-marketing";
import TaskComposer, { type ComposerValue } from "@/components/tasks/task-composer";
import { PersonPicker } from "@/components/tasks/task-pickers";
import { Avatar, personName } from "@/components/tasks/task-format";
import {
  CAMPAIGN_SWATCH,
  CampaignPicker,
  ChannelChip,
  ChannelPicker,
  PublishPicker,
  StagePicker,
  StagePill,
} from "@/components/tasks/marketing-format";
import { LaunchPicker } from "@/components/tasks/marketing-piece";
import type { TaskChannel, TaskStage } from "@/types/tasks";

const chip =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-sm text-gray-700 hover:bg-gray-50";

export interface PieceDefaults {
  campaignId?: string | null;
  parentId?: string | null;
  publishOn?: string | null;
}

/** A marketing piece: a title is enough; the brief and approval come after. */
export default function NewPieceDialog({
  open,
  defaults,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  defaults: PieceDefaults | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: people = [] } = useTaskPeople();
  const { data: marketing } = useMarketing(null, open);
  const campaigns = marketing?.campaigns ?? [];
  const [title, setTitle] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [channel, setChannel] = useState<TaskChannel | null>(null);
  const [stage, setStage] = useState<TaskStage>("coming");
  const [publish, setPublish] = useState<{ on: string | null; time: string | null }>({ on: null, time: null });
  const [owner, setOwner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [round, setRound] = useState(0);
  const description = useRef<ComposerValue>({ body: "", format: "html", mentions: [], attachmentIds: [], uploading: false });
  const [uploading, setUploading] = useState(false);

  // Each time it opens, start from where it was opened (a campaign, a
  // launch, a day), set during render rather than in an effect.
  const [seen, setSeen] = useState<{ open: boolean; defaults: PieceDefaults | null }>({ open: false, defaults: null });
  if (seen.open !== open || seen.defaults !== defaults) {
    setSeen({ open, defaults });
    if (open) {
      setCampaignId(defaults?.campaignId ?? null);
      setParentId(defaults?.parentId ?? null);
      setPublish({ on: defaults?.publishOn ?? null, time: null });
    }
  }

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const launches = launchesFor(marketing?.pieces ?? [], campaignId, { parentId });
  const launch = launches.find((p) => p.id === parentId) ?? null;

  const reset = () => {
    setTitle("");
    setChannel(null);
    setStage("coming");
    setOwner(null);
    setRound((n) => n + 1);
  };

  const create = async () => {
    if (!title.trim() || saving || uploading) return;
    setSaving(true);
    try {
      const { body, format, mentions, attachmentIds } = description.current;
      const task = await createTask({
        title: title.trim(),
        ...(owner ? { ownerEmail: owner } : {}),
        ...(body.trim() || attachmentIds.length ? { description: { body, format, mentions, attachmentIds } } : {}),
        marketing: {
          stage,
          ...(campaignId ? { campaignId } : {}),
          ...(parentId ? { parentId } : {}),
          ...(channel ? { channel } : {}),
          ...(publish.on ? { publishOn: publish.on, publishTime: publish.time } : {}),
        },
      });
      void queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
      reset();
      onOpenChange(false);
      onCreated(task.id);
    } catch {
      // The API layer shows the error; keep what was typed.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
          <DialogTitle>New piece</DialogTitle>
          <DialogDescription>A post, email, push or article. Add the brief and ask for approval once it&apos;s open.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4 pt-2">
          <input
            autoFocus
            value={title}
            maxLength={200}
            placeholder="Money you can save on AI subscriptions with Solid"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void create();
              }
            }}
            className="w-full border-0 border-b border-gray-200 px-0 py-2 text-lg font-medium text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500"
          />

          <div className="flex flex-wrap gap-2">
            <CampaignPicker
              campaigns={campaigns}
              value={campaignId}
              onChange={(next) => {
                setCampaignId(next);
                // A launch is in one campaign: a new campaign leaves it.
                if (next !== campaignId) setParentId(null);
              }}
            >
              <button type="button" className={chip}>
                {campaign ? (
                  <>
                    <span className={cn("size-2.5 shrink-0 rounded-[3px]", CAMPAIGN_SWATCH[campaign.color])} />
                    <span className="max-w-48 truncate">{campaign.name}</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid className="size-4 text-gray-400" /> Campaign
                  </>
                )}
              </button>
            </CampaignPicker>
            {(launches.length > 0 || parentId) && (
              <LaunchPicker launches={launches} value={parentId} onChange={setParentId}>
                <button type="button" className={chip}>
                  <Rocket className="size-4 text-gray-400" />
                  <span className="max-w-48 truncate">{launch?.title ?? "Launch"}</span>
                </button>
              </LaunchPicker>
            )}
            <ChannelPicker value={channel} onChange={setChannel}>
              <button type="button" className={chip}>
                {channel ? (
                  <ChannelChip channel={channel} className="h-5 border-0 px-0" />
                ) : (
                  <>
                    <Megaphone className="size-4 text-gray-400" /> Channel
                  </>
                )}
              </button>
            </ChannelPicker>
            <StagePicker value={stage} onChange={setStage}>
              <button type="button" className={chip}>
                <StagePill stage={stage} className="h-5" />
              </button>
            </StagePicker>
            <PublishPicker on={publish.on} time={publish.time} onChange={setPublish}>
              <button type="button" className={chip}>
                <CalendarDays className="size-4 text-gray-400" />
                {publishLabel(publish.on, publish.time) ?? "Publish"}
              </button>
            </PublishPicker>
            <PersonPicker people={people} value={owner} onChange={setOwner}>
              <button type="button" className={chip}>
                {owner ? (
                  <>
                    <Avatar email={owner} people={people} size={18} />
                    {personName(owner, people)}
                  </>
                ) : (
                  <>
                    <User className="size-4 text-gray-400" /> Owner
                  </>
                )}
              </button>
            </PersonPicker>
          </div>

          <TaskComposer
            key={round}
            people={people}
            hideSubmit
            minRows={3}
            placeholder="Notes, drafts, links… @ to mention"
            onChange={(value) => {
              description.current = value;
              setUploading(value.uploading);
            }}
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            disabled={!title.trim() || saving || uploading}
            onClick={() => void create()}
          >
            {saving && <Loader2 className="animate-spin" />}
            Create piece
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
