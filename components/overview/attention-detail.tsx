"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { describeApiError } from "@/lib/api";
import {
  TONE_CLASSES,
  elapsed,
  levelBadge,
  statusPill,
  stillHappening,
} from "@/lib/attention";
import { formatCount } from "@/lib/overview-format";
import { useAttentionAction, useAttentionItem } from "@/hooks/use-attention";
import type {
  AttentionItemView,
  RadarFlow,
  RadarTimelineEntry,
} from "@/types/radar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ReasonDialog } from "@/components/overview/reason-dialog";
import { NoticePanel } from "@/components/overview/notice-panel";

const FLOW_NAMES: Record<RadarFlow, string> = {
  send: "Send",
  withdraw: "Withdraw",
  swap: "Swap",
  bridge: "Bridge",
  card_topup: "Card top-up",
  card_activation: "Card activation",
  deposit: "Deposit",
};

const DOT: Partial<Record<RadarTimelineEntry["kind"], string>> = {
  opened: "bg-[#dc2626]",
  level: "bg-[#7e22ce]",
  new_flow: "bg-[#dc2626]",
  people_doubled: "bg-[#dc2626]",
  errors_stopped: "bg-[#16a34a]",
  fixed_offered: "bg-[#16a34a]",
  resolved: "bg-[#16a34a]",
  auto_resolved: "bg-[#16a34a]",
  dismissed: "bg-gray-400",
};

/**
 * One item, opened from the card: what the radar sees, the likely cause and
 * fix from the error text, the timeline, and the actions.
 */
export function AttentionDetail({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { data: item, isLoading } = useAttentionItem(id);
  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle className="sr-only">
          {item?.title ?? "Attention item"}
        </DialogTitle>
        {isLoading || !item ? (
          <p className="py-8 text-center text-[13px] text-gray-400">Loading…</p>
        ) : (
          <Detail item={item} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  item,
  onDone,
}: {
  item: AttentionItemView;
  onDone: () => void;
}) {
  const action = useAttentionAction();
  const [closing, setClosing] = useState<"dismiss" | "resolve" | null>(null);
  const now = new Date().toISOString();
  const live = item.status !== "resolved" && stillHappening(item, now);
  const badge = levelBadge(item);
  const status = statusPill(item.status);
  const resolved = item.status === "resolved";
  const flows = Object.entries(item.flowCounts)
    .filter(
      (entry): entry is [RadarFlow, number] =>
        typeof entry[1] === "number" && entry[1] > 0,
    )
    .sort((a, b) => b[1] - a[1]);
  const maxFlow = Math.max(1, ...flows.map(([, n]) => n));
  const span = elapsed(
    item.firstSeenAt,
    resolved ? (item.resolvedAt ?? item.lastSeenAt) : now,
  );
  const perPerson =
    item.affectedCount > 1
      ? Math.round(
          (Date.parse(item.lastSeenAt) - Date.parse(item.firstSeenAt)) /
            60_000 /
            item.affectedCount,
        )
      : null;

  const run = (input: Parameters<typeof action.mutate>[0], done: string) =>
    action.mutate(input, {
      onSuccess: () => toast.success(done),
      onError: (e) => toast.error(describeApiError(e)),
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 pr-8">
        <span
          className={cn(
            "rounded-[5px] px-2 py-[3px] text-[11px] font-bold tracking-[0.4px]",
            TONE_CLASSES[badge.tone],
          )}
        >
          {badge.label}
          {item.level === "incident" && live ? " · LIVE" : ""}
        </span>
        {item.status === "in_solid" && item.slackThreadTs ? null : (
          <span
            className={cn(
              "rounded-full px-2.5 py-[3px] text-[12px] font-medium",
              TONE_CLASSES[status.tone],
            )}
          >
            {status.label}
          </span>
        )}
        {item.slackThreadTs ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-[3px] text-[12px] font-medium",
              TONE_CLASSES.purple,
            )}
          >
            In #solid since{" "}
            {(
              item.timeline.find((t) => t.kind === "slack")?.at ??
              item.firstSeenAt
            ).slice(11, 16)}
          </span>
        ) : null}
        {item.noticeDraft?.status === "pending" ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-[3px] text-[12px] font-medium",
              TONE_CLASSES.orange,
            )}
          >
            App notice waiting for approval
          </span>
        ) : null}
        <span className="rounded-[4px] bg-[#f4f5f8] px-1.5 text-[11px] font-medium text-gray-500">
          {item.tag}
        </span>
        <span className="ml-auto text-[12px] text-gray-500">
          {item.owner
            ? `Owner: ${item.owner.name ?? item.owner.email}`
            : "Unassigned"}
        </span>
      </div>

      <h3 className="mt-3 text-[18px] font-semibold text-gray-900">
        {item.title}
      </h3>
      <p className="mt-0.5 text-[13px] text-gray-500">
        Started {item.firstSeenAt.slice(11, 16)} UTC {dayOf(item.firstSeenAt)} ·{" "}
        {span}
        {resolved
          ? " · resolved"
          : live
            ? " · still happening"
            : " · no new errors since " + item.lastSeenAt.slice(11, 16)}
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <p className="border-b border-[#eef0f4] pb-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            What the radar sees
          </p>
          {item.failures > 0 ? (
            <>
              <Bullet>
                <strong>{formatCount(item.failures)} failed actions</strong> in{" "}
                {span}
                {item.codes.length === 1 ? ", all with the same error" : ""}.
                {item.normalPerDay !== null
                  ? ` Normal: about ${Math.round(item.normalPerDay)} a day.`
                  : ""}
              </Bullet>
              <Bullet>
                <strong>
                  {formatCount(item.affectedCount)}{" "}
                  {item.affectedCount === 1 ? "person" : "people"} hit
                </strong>
                {perPerson
                  ? ` so far, about one new person every ${perPerson} minutes.`
                  : " so far."}
              </Bullet>
              {flows.length > 0 ? (
                <Bullet tone="orange">
                  <strong>
                    Same error in {flows.length}{" "}
                    {flows.length === 1 ? "flow" : "flows"}
                  </strong>
                  {flows.length > 1 ? ", grouped into one item:" : ":"}
                  <div className="mt-2 flex flex-col gap-1.5">
                    {flows.map(([flow, n]) => (
                      <div
                        key={flow}
                        className="grid grid-cols-[110px_1fr_32px] items-center gap-2 text-[12.5px]"
                      >
                        <span className="text-gray-700">
                          {FLOW_NAMES[flow]}
                        </span>
                        <span className="h-1.5 rounded-full bg-[#f1f2f6]">
                          <span
                            className="block h-full rounded-full bg-[#dc2626]"
                            style={{ width: `${(n / maxFlow) * 100}%` }}
                          />
                        </span>
                        <span className="text-right text-gray-500">
                          {formatCount(n)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Bullet>
              ) : null}
            </>
          ) : (
            item.signals.map((signal) => (
              <Bullet key={`${signal.detector}:${signal.key}`}>
                <strong>{signal.title}</strong>
                <span className="block text-gray-500">{signal.metaLine}</span>
              </Bullet>
            ))
          )}

          {item.likelyCause || item.sampleError ? (
            <div className="mt-3 rounded-lg border border-[#f5c2c2] bg-[#fdf3f3] px-3.5 py-3 text-[12.5px] leading-[18px] text-gray-700">
              {item.likelyCause ? (
                <>
                  <p>
                    <strong className="text-[#b91c1c]">Likely cause:</strong>{" "}
                    {item.likelyCause.cause}.
                  </p>
                  <p>
                    <strong className="text-[#b91c1c]">Fix:</strong>{" "}
                    {item.likelyCause.fix}.
                  </p>
                </>
              ) : null}
              {item.sampleError ? (
                <p className="mt-1.5 font-mono text-[11px] break-words text-gray-500">
                  {item.sampleError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <p className="border-b border-[#eef0f4] pb-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Timeline
          </p>
          <ol className="mt-2 flex flex-col gap-3 border-l border-[#e6e8ee] pl-4">
            {item.timeline.map((entry, i) => (
              <li
                key={`${entry.at}-${i}`}
                className="relative text-[12.5px] leading-[17px] text-gray-700"
              >
                <span
                  className={cn(
                    "absolute top-1 -left-[21px] size-2.5 rounded-[3px]",
                    DOT[entry.kind] ?? "bg-gray-300",
                  )}
                />
                <span className="block text-[11px] text-gray-400">
                  {dayOf(entry.at)} {entry.at.slice(11, 16)}
                </span>
                {entry.text}
                {entry.by ? (
                  <span className="text-gray-400">
                    {" "}
                    · {entry.by.split("@")[0]}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <NoticePanel item={item} />

      {!resolved ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#eef0f4] pt-4">
          {item.mainAction ? (
            <Link
              href={item.mainAction.href}
              className="rounded-[7px] bg-[#111827] px-3 py-1.5 text-[12.5px] font-medium text-white"
            >
              {item.mainAction.label}
            </Link>
          ) : null}
          <ActionButton
            onClick={() =>
              run(
                { kind: "assign", id: item.id, owner: "me" },
                "Assigned to you",
              )
            }
          >
            {item.owner ? "Take it" : "I'm on it"}
          </ActionButton>
          <ActionButton
            onClick={() =>
              run(
                { kind: "snooze", id: item.id, hours: 1 },
                "Snoozed for an hour",
              )
            }
          >
            Snooze 1 h
          </ActionButton>
          <ActionButton onClick={() => setClosing("resolve")}>
            {item.fixedOfferedAt ? "Mark fixed" : "Resolve…"}
          </ActionButton>
          <ActionButton onClick={() => setClosing("dismiss")}>
            Dismiss…
          </ActionButton>
        </div>
      ) : item.resolutionReason ? (
        <p className="mt-5 border-t border-[#eef0f4] pt-4 text-[12.5px] text-gray-500">
          {item.resolution === "dismissed" ? "Dismissed" : "Resolved"}:{" "}
          {item.resolutionReason}
        </p>
      ) : null}

      <ReasonDialog
        open={closing !== null}
        title={
          closing === "resolve" ? "Resolve this item" : "Dismiss this item"
        }
        description={item.title}
        confirmLabel={closing === "resolve" ? "Resolve" : "Dismiss"}
        pending={action.isPending}
        onCancel={() => setClosing(null)}
        onConfirm={(reason) =>
          action.mutate(
            { kind: closing ?? "dismiss", id: item.id, reason },
            {
              onSuccess: () => {
                toast.success(closing === "resolve" ? "Resolved" : "Dismissed");
                setClosing(null);
                onDone();
              },
              onError: (e) => toast.error(describeApiError(e)),
            },
          )
        }
      />
    </div>
  );
}

function Bullet({
  children,
  tone = "red",
}: {
  children: React.ReactNode;
  tone?: "red" | "orange";
}) {
  return (
    <div className="flex gap-2.5 border-b border-[#f4f5f8] py-2.5 text-[13px] leading-[19px] text-gray-700">
      <span
        className={cn(
          "mt-[7px] size-[7px] shrink-0 rounded-full",
          tone === "red" ? "bg-[#dc2626]" : "bg-[#d97706]",
        )}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[7px] border border-[#e6e8ee] bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-800 hover:border-gray-300"
    >
      {children}
    </button>
  );
}

/** "Oct 30" in UTC. */
function dayOf(iso: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}
