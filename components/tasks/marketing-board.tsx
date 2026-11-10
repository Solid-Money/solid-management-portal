"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMarketing, useTaskPeople } from "@/hooks/use-tasks";
import { patchCampaign } from "@/lib/tasks-api";
import { sprintLabel } from "@/lib/task-format";
import {
  assetLabel,
  calendarWeek,
  campaignDates,
  groupByCampaign,
  hasBrief,
  localToday,
  publishLabel,
  shiftWeek,
  weekRange,
  weekStart,
  type MarketingGroup,
} from "@/lib/task-marketing";
import { PersonPicker } from "@/components/tasks/task-pickers";
import { Avatar, firstName, personName } from "@/components/tasks/task-format";
import {
  CAMPAIGN_SWATCH,
  CHANNEL_META,
  ChannelChip,
  ChannelPicker,
  STAGE_META,
  StagePicker,
  StagePill,
} from "@/components/tasks/marketing-format";
import CampaignDialog from "@/components/tasks/campaign-dialog";
import type { PieceDefaults } from "@/components/tasks/new-piece-dialog";
import type { TaskCampaign, TaskChannel, TaskPerson, TaskRow, TaskStage } from "@/types/tasks";

export type MarketingView = "campaign" | "calendar";

export interface MarketingFilters {
  q: string | null;
  channel: TaskChannel | null;
  stage: TaskStage | null;
  /** An email, or "none" for pieces nobody owns. */
  owner: string | null;
}

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_140px_150px_150px_130px_120px] gap-3";

function onKey(open: () => void) {
  return (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };
}

function isLate(row: TaskRow, today: string): boolean {
  const on = row.marketing?.publishOn;
  const closed = row.status === "done" || row.status === "cancelled" || row.marketing?.stage === "posted";
  return !!on && on < today && !closed;
}

function PieceRow({
  row,
  child,
  pieces,
  collapsed,
  onToggle,
  people,
  today,
  selected,
  onOpen,
}: {
  row: TaskRow;
  child: boolean;
  /** Pieces under it (a launch). */
  pieces: number;
  collapsed: boolean;
  onToggle: () => void;
  people: TaskPerson[];
  today: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const piece = row.marketing!;
  const cancelled = row.status === "cancelled";
  const publish = publishLabel(piece.publishOn, piece.publishTime);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={row.title}
      onClick={onOpen}
      onKeyDown={onKey(onOpen)}
      className={cn(
        COLUMNS,
        "min-h-11 cursor-pointer items-center border-b border-gray-100 px-4 py-1.5 text-sm outline-none hover:bg-gray-50 focus-visible:bg-indigo-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400",
        child && "bg-gray-50/40",
        selected && "bg-indigo-50/60 hover:bg-indigo-50",
      )}
    >
      <div className={cn("flex min-w-0 items-center gap-2", child && "pl-7")}>
        {pieces > 0 && (
          <button
            type="button"
            aria-label={collapsed ? "Show its pieces" : "Hide its pieces"}
            aria-expanded={!collapsed}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="-ml-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-200"
          >
            <ChevronRight className={cn("size-4 transition-transform", !collapsed && "rotate-90")} />
          </button>
        )}
        <span
          className={cn(
            "truncate",
            pieces > 0 ? "font-medium text-gray-900" : "text-gray-800",
            row.hasNew && "font-semibold text-gray-900",
            cancelled && "text-gray-400 line-through",
          )}
        >
          {row.title}
        </span>
        {pieces > 0 && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 text-xs text-gray-600">
            {pieces} {pieces === 1 ? "piece" : "pieces"}
          </span>
        )}
        {hasBrief(row) && (
          <span className="hidden shrink-0 rounded-full bg-indigo-50 px-2 text-xs text-indigo-700 sm:inline">Brief</span>
        )}
      </div>
      <div>
        <ChannelChip channel={piece.channel} />
      </div>
      <div>
        <StagePill stage={piece.stage} cancelled={cancelled} />
      </div>
      <div className={cn("truncate text-[13px]", !publish ? "text-gray-300" : isLate(row, today) ? "text-red-600" : "text-gray-700")}>
        {publish ?? "—"}
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-gray-700">
        {row.ownerEmail ? (
          <>
            <Avatar email={row.ownerEmail} people={people} size={22} />
            <span className="truncate">{firstName(row.ownerEmail, people)}</span>
          </>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>
      <div className="min-w-0 text-[13px]">
        {piece.assetUrl ? (
          <a
            href={piece.assetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex max-w-full items-center gap-1 font-medium text-indigo-700 hover:underline"
          >
            <span className="truncate">{assetLabel(piece.assetUrl)}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>
    </div>
  );
}

function CampaignSection({
  group,
  filtered,
  people,
  today,
  selected,
  onOpen,
  onNewPiece,
  onEdit,
}: {
  group: MarketingGroup;
  filtered: boolean;
  people: TaskPerson[];
  today: string;
  selected: string | null;
  onOpen: (id: string) => void;
  onNewPiece: (defaults: PieceDefaults) => void;
  onEdit: (campaign: TaskCampaign) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const { campaign } = group;
  const dates = campaign ? campaignDates(campaign) : null;
  const percent = group.total ? Math.round((group.posted / group.total) * 100) : 0;

  const archive = async (target: TaskCampaign, archived: boolean) => {
    await patchCampaign(target.id, { archived });
    void queryClient.invalidateQueries({ queryKey: ["tasks", "marketing"] });
    if (archived)
      toast("Campaign archived", {
        description: "Its pieces still show on the calendar.",
        action: { label: "Undo", onClick: () => void archive(target, false) },
      });
  };

  // A folded launch hides its pieces (never while filtering: what matched shows).
  const rows = group.rows.filter((row) => !row.child || filtered || !folded.has(row.piece.marketing?.parentId ?? ""));

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-gray-100 px-4 py-3">
        <button
          type="button"
          aria-label={open ? "Hide the campaign's pieces" : "Show the campaign's pieces"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100"
        >
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        </button>
        <span
          className={cn("size-2.5 shrink-0 rounded-[3px]", campaign ? CAMPAIGN_SWATCH[campaign.color] : "bg-gray-300")}
          aria-hidden="true"
        />
        <h2 className="text-[15px] font-semibold text-gray-900">{campaign?.name ?? "No campaign"}</h2>
        {dates && <span className="text-[13px] text-gray-500">{dates}</span>}
        <span className="ml-auto text-[13px] text-gray-600">
          {group.total ? `${group.posted} of ${group.total} posted` : "No pieces yet"}
        </span>
        <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-gray-100 sm:block" aria-hidden="true">
          <div className="h-1.5 bg-green-500" style={{ width: `${percent}%` }} />
        </div>
        {campaign && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${campaign.name} options`}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(campaign)}>
                <Pencil /> Edit campaign
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void archive(campaign, true)}>
                <Archive /> Archive campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {open && (
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className={cn(COLUMNS, "border-b border-gray-100 bg-gray-50/70 px-4 py-2 text-xs font-medium text-gray-500")}>
              <span>Piece</span>
              <span>Channel</span>
              <span>Status</span>
              <span>Publish</span>
              <span>Owner</span>
              <span>Asset</span>
            </div>
            {rows.map((row) => (
              <PieceRow
                key={row.piece.id}
                row={row.piece}
                child={row.child}
                pieces={row.children}
                collapsed={folded.has(row.piece.id)}
                onToggle={() =>
                  setFolded((current) => {
                    const next = new Set(current);
                    if (next.has(row.piece.id)) next.delete(row.piece.id);
                    else next.add(row.piece.id);
                    return next;
                  })
                }
                people={people}
                today={today}
                selected={selected === row.piece.id}
                onOpen={() => onOpen(row.piece.id)}
              />
            ))}
            {rows.length === 0 && filtered && (
              <p className="border-b border-gray-100 px-4 py-3 text-sm text-gray-400">No pieces here match.</p>
            )}
            <button
              type="button"
              onClick={() => onNewPiece({ campaignId: campaign?.id ?? null })}
              className="flex h-10 w-full cursor-pointer items-center gap-1.5 px-4 text-left text-[13px] text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            >
              <Plus className="size-3.5" />
              {campaign ? "Add a piece to this campaign" : "Add a piece"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CalendarCard({
  row,
  campaign,
  selected,
  onOpen,
}: {
  row: TaskRow;
  campaign: TaskCampaign | null;
  selected: boolean;
  onOpen: () => void;
}) {
  const piece = row.marketing!;
  const channel = piece.channel ? CHANNEL_META[piece.channel] : null;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={row.title}
      onClick={onOpen}
      onKeyDown={onKey(onOpen)}
      className={cn(
        "flex cursor-pointer flex-col gap-1.5 rounded-lg border border-gray-200 bg-white p-2.5 text-left shadow-[0_1px_1px_rgba(0,0,0,0.02)] outline-none hover:border-gray-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-400",
        selected && "border-indigo-300 ring-1 ring-indigo-200",
      )}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-gray-700">
          <span className={cn("size-[7px] shrink-0 rounded-full", channel?.dot ?? "bg-gray-300")} aria-hidden="true" />
          <span className="truncate">{channel?.label ?? "No channel"}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-gray-500">{piece.publishTime ?? "All day"}</span>
      </span>
      <span className={cn("text-[13px] font-medium leading-snug text-gray-900", row.status === "cancelled" && "text-gray-400 line-through")}>
        {row.title}
      </span>
      <span className="flex items-center justify-between gap-1.5">
        <StagePill stage={piece.stage} cancelled={row.status === "cancelled"} className="h-5 px-2 text-[11px]" />
        {campaign && <span className="truncate text-[11px] text-gray-500">{campaign.name}</span>}
      </span>
    </div>
  );
}

/**
 * The Marketing tab, like monday's Marketing Content board: campaigns with
 * their pieces (launches with the pieces under them), or a week's calendar
 * of what goes out each day. Pieces are tasks; a click opens the drawer.
 */
export default function MarketingBoard({
  view,
  onView,
  week,
  onWeek,
  filters,
  onFilters,
  selected,
  onOpen,
  onNewPiece,
}: {
  view: MarketingView;
  onView: (view: MarketingView) => void;
  /** The calendar's Monday (`YYYY-MM-DD`), or null for this week. */
  week: string | null;
  onWeek: (start: string | null) => void;
  filters: MarketingFilters;
  onFilters: (next: Partial<MarketingFilters>) => void;
  selected: string | null;
  onOpen: (id: string) => void;
  onNewPiece: (defaults: PieceDefaults) => void;
}) {
  const { data: people = [] } = useTaskPeople();
  const today = localToday();
  const thisWeek = weekStart(today);
  const start = week ?? thisWeek;
  const calendar = view === "calendar";
  const overview = useMarketing(calendar ? weekRange(start) : null);
  const [search, setSearch] = useState(filters.q ?? "");
  const [editing, setEditing] = useState<{ campaign: TaskCampaign | null } | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = !!(q || filters.channel || filters.stage || filters.owner);
  const matches = useMemo(
    () => (row: TaskRow) =>
      (!q || row.title.toLowerCase().includes(q)) &&
      (!filters.channel || row.marketing?.channel === filters.channel) &&
      (!filters.stage || row.marketing?.stage === filters.stage) &&
      (!filters.owner || (filters.owner === "none" ? !row.ownerEmail : row.ownerEmail === filters.owner)),
    [q, filters.channel, filters.stage, filters.owner],
  );
  const groups = useMemo(
    () => (overview.data && !calendar ? groupByCampaign(overview.data, matches) : []),
    [overview.data, calendar, matches],
  );
  const days = useMemo(
    () => (overview.data && calendar ? calendarWeek(start, overview.data.pieces.filter(matches), today) : []),
    [overview.data, calendar, start, matches, today],
  );
  const campaignOf = (row: TaskRow) =>
    overview.data?.campaigns.find((c) => c.id === row.marketing?.campaignId) ?? null;
  // While filtering, campaigns with nothing that matches step aside.
  const shownGroups = filtered ? groups.filter((group) => group.rows.length > 0) : groups;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-[3px]">
            {(
              [
                { key: "campaign", label: "By campaign" },
                { key: "calendar", label: "Calendar" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => onView(key)}
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-[13px] font-medium",
                  view === key ? "bg-indigo-50 text-indigo-800" : "text-gray-600 hover:text-gray-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {calendar && (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="size-8" aria-label="Previous week" onClick={() => onWeek(shiftWeek(start, -1))}>
                <ChevronLeft />
              </Button>
              <span className="min-w-28 px-1 text-center text-[15px] font-semibold text-gray-900">{sprintLabel(start)}</span>
              <Button variant="outline" size="icon" className="size-8" aria-label="Next week" onClick={() => onWeek(shiftWeek(start, 1))}>
                <ChevronRight />
              </Button>
              {start !== thisWeek && (
                <Button variant="outline" size="sm" className="h-8" onClick={() => onWeek(null)}>
                  This week
                </Button>
              )}
            </div>
          )}
          <form
            className="relative w-full sm:w-60"
            onSubmit={(event) => {
              event.preventDefault();
              onFilters({ q: search.trim() || null });
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (!event.target.value) onFilters({ q: null });
              }}
              onBlur={() => (search.trim() || null) !== filters.q && onFilters({ q: search.trim() || null })}
              placeholder="Search pieces"
              aria-label="Search pieces"
              className="h-8 pl-8 text-sm"
            />
          </form>
          <ChannelPicker value={filters.channel} onChange={(channel) => onFilters({ channel })} noneLabel="Any channel">
            <Button variant="outline" size="sm" className={cn(filters.channel && "border-indigo-300 text-indigo-700")}>
              Channel: {filters.channel ? CHANNEL_META[filters.channel].label : "Any"}
            </Button>
          </ChannelPicker>
          <StagePicker value={filters.stage} onChange={(stage) => onFilters({ stage })} onClear={() => onFilters({ stage: null })}>
            <Button variant="outline" size="sm" className={cn(filters.stage && "border-indigo-300 text-indigo-700")}>
              Status: {filters.stage ? STAGE_META[filters.stage].label : "Any"}
            </Button>
          </StagePicker>
          <PersonPicker
            people={people}
            value={filters.owner && filters.owner !== "none" ? filters.owner : null}
            onChange={(owner) => onFilters({ owner: owner ?? "none" })}
          >
            <Button variant="outline" size="sm" className={cn(filters.owner && "border-indigo-300 text-indigo-700")}>
              Owner: {filters.owner === "none" ? "Nobody" : filters.owner ? personName(filters.owner, people) : "Anyone"}
            </Button>
          </PersonPicker>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500"
              onClick={() => {
                setSearch("");
                onFilters({ q: null, channel: null, stage: null, owner: null });
              }}
            >
              <X /> Clear
            </Button>
          )}
          {overview.isFetching && !overview.isLoading && <Loader2 className="size-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing({ campaign: null })}>
            <Plus /> New campaign
          </Button>
          <Button size="sm" className="h-8 bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => onNewPiece({})}>
            <Plus /> New piece
          </Button>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-indigo-600" />
        </div>
      ) : overview.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          Couldn&apos;t load marketing.{" "}
          <button type="button" className="cursor-pointer underline" onClick={() => void overview.refetch()}>
            Try again
          </button>
        </div>
      ) : calendar ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="grid min-w-[1120px] grid-cols-7">
            {days.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "group/day flex min-h-[560px] flex-col gap-2 border-r border-gray-100 px-2.5 py-3 last:border-r-0",
                  day.pieces.length === 0 && "bg-gray-50/60",
                )}
              >
                <div className="flex h-8 items-center justify-between px-0.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{day.weekday}</span>
                  <span
                    className={cn(
                      "text-lg font-semibold text-gray-900",
                      day.today && "flex size-8 items-center justify-center rounded-full bg-indigo-600 text-base text-white",
                    )}
                  >
                    {day.day}
                  </span>
                </div>
                {day.pieces.map((row) => (
                  <CalendarCard
                    key={row.id}
                    row={row}
                    campaign={campaignOf(row)}
                    selected={selected === row.id}
                    onOpen={() => onOpen(row.id)}
                  />
                ))}
                {day.pieces.length === 0 && (
                  <span className="px-1 py-2 text-xs text-gray-400">{filtered ? "Nothing matches" : "Nothing going out"}</span>
                )}
                <button
                  type="button"
                  onClick={() => onNewPiece({ publishOn: day.date })}
                  className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 group-hover/day:opacity-100"
                >
                  <Plus className="size-3.5" /> Add a piece
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : shownGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-16 text-center text-sm text-gray-500">
          {filtered ? (
            "No pieces match these filters."
          ) : (
            <div className="space-y-3">
              <p>No campaigns yet. Start one for a week&apos;s theme or a launch, then add its pieces.</p>
              <Button variant="outline" size="sm" onClick={() => setEditing({ campaign: null })}>
                <Plus /> New campaign
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {shownGroups.map((group) => (
            <CampaignSection
              key={group.campaign?.id ?? "none"}
              group={group}
              filtered={filtered}
              people={people}
              today={today}
              selected={selected}
              onOpen={onOpen}
              onNewPiece={onNewPiece}
              onEdit={(campaign) => setEditing({ campaign })}
            />
          ))}
        </div>
      )}
      {overview.data?.truncated && (
        <p className="text-center text-xs text-gray-500">Showing the first 1,000 pieces.</p>
      )}

      <CampaignDialog
        open={editing !== null}
        campaign={editing?.campaign ?? null}
        onOpenChange={(next) => !next && setEditing(null)}
      />
    </div>
  );
}
