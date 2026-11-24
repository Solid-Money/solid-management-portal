"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Gauge,
  Loader2,
  PiggyBank,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { ConfigSection, InfoTooltip } from "@/components/config/config-fields";
import { NotAvailableYet } from "@/components/referral-v4/not-available";
import UserLink from "@/components/user-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getTierBalanceOverview,
  previewTierBalanceConfig,
  runTierBalance,
  updateTierBalanceConfig,
} from "@/lib/api";
import { isNotAvailable } from "@/lib/referral-v4";
import {
  TIER_BALANCE_AUDIENCE_LABELS,
  TIER_BALANCE_BOUNDS,
  TIER_BALANCE_FIELD_LABELS,
  TIER_BALANCE_RUN_KIND,
  TIER_BALANCE_RUN_STATUS,
  TIER_BALANCE_RUN_TRIGGER,
  TIER_BALANCE_TIER_LABELS,
  TIER_BALANCE_TIER_VARIANT,
  describeTierBalanceRun,
  formatTierBalanceValue,
  tierBalanceChanges,
  tierBalanceFieldErrors,
  tierBalanceUsd,
  toTierBalanceDraft,
  type TierBalanceBooleanField,
  type TierBalanceDraft,
  type TierBalanceNumberField,
} from "@/lib/tier-balance";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import type {
  TierBalanceAdminOverview,
  TierBalanceAudience,
  TierBalanceConfig,
  TierBalanceConfigPreview,
  TierBalanceRunAction,
  TierBalanceRunResult,
  TierBalanceRunView,
  TierBalanceStateCounts,
} from "@/types";

export const TIER_BALANCE_OVERVIEW_KEY = ["tier-balance-overview"] as const;

const count = (value: number) => formatNumber(value, 0, 0);

const dateOrDash = (value: string | null | undefined) =>
  value ? formatDateTime(value) : "—";

const STATE_ROWS: Array<{ key: keyof TierBalanceStateCounts; label: string }> =
  [
    { key: "ultra", label: "Ultra" },
    { key: "prime", label: "Prime" },
    { key: "building", label: "Building" },
    { key: "grace", label: "In grace" },
    { key: "cooldown", label: "Cooldown" },
  ];

/** "(100–10,000,000)": a field's accepted range, after its help line. */
function rangeHint(field: TierBalanceNumberField, maxOverride?: number): string {
  const { min, max } = TIER_BALANCE_BOUNDS[field];
  return `(${count(min)}–${count(maxOverride ?? max)})`;
}

/** The shadcn Input's look, for the one native select (no Select in components/ui). */
const SELECT_CLASS =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h4 className="mb-1 text-sm font-semibold text-gray-900">{title}</h4>
      <p className="mb-4 text-xs text-gray-500">{description}</p>
      {children}
    </div>
  );
}

function NumberField({
  field,
  value,
  onChange,
  error,
  help,
  suffix,
  step,
  maxOverride,
}: {
  field: TierBalanceNumberField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  help: string;
  suffix: string;
  step?: string;
  /** The range's upper end when another field moves it (days allowed unmeasured). */
  maxOverride?: number;
}) {
  const id = `tier-balance-${field}`;
  const { min, max, integer } = TIER_BALANCE_BOUNDS[field];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{TIER_BALANCE_FIELD_LABELS[field]}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          min={min}
          max={maxOverride ?? max}
          step={step ?? (integer ? "1" : "any")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
        />
        <span className="text-sm whitespace-nowrap text-gray-500">
          {suffix}
        </span>
      </div>
      <p
        id={`${id}-help`}
        className={cn("text-xs", error ? "text-red-600" : "text-gray-500")}
      >
        {error ?? (
          <>
            {help}{" "}
            <span className="text-gray-400">{rangeHint(field, maxOverride)}</span>
          </>
        )}
      </p>
    </div>
  );
}

function SwitchField({
  field,
  checked,
  onChange,
  help,
}: {
  field: TierBalanceBooleanField;
  checked: boolean;
  onChange: (value: boolean) => void;
  help: string;
}) {
  const id = `tier-balance-${field}`;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <Label htmlFor={id}>{TIER_BALANCE_FIELD_LABELS[field]}</Label>
        <p id={`${id}-help`} className="text-xs text-gray-500">
          {help}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-help`}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

/**
 * Config → Rewards → Hold in Earn route (T-314): users unlock Prime or Ultra
 * by holding a USD balance in Earn through a lookback window, next to the paid
 * membership and the FUSE lock.
 *
 * Talks to its own endpoints, not the rewards config document. Every change
 * that reaches users goes Preview → confirm: a save is previewed by the server
 * (changes, state counts before and after, the users whose tier moves,
 * warnings) and only the previewed fields are saved; "Run now" asks first.
 */
export default function TierBalanceConfigSection() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: TIER_BALANCE_OVERVIEW_KEY,
    queryFn: async () => (await getTierBalanceOverview()).data.data,
    retry: false,
  });

  // Only the fields the admin touched, laid over the saved config: a refetch
  // (another admin saved, the window regained focus) never turns an untouched
  // field into a change that would revert theirs.
  const [edits, setEdits] = useState<Partial<TierBalanceDraft>>({});

  return (
    <ConfigSection
      id="tier-balance"
      title="Hold in Earn route"
      description="Prime or Ultra for holding a balance in Earn through a lookback window — a third route next to the paid membership and the FUSE lock. Staged to tagged internal team members until the audience is switched to everyone. Yield Boost is never part of it."
      icon={<PiggyBank className="h-5 w-5 text-emerald-600" />}
    >
      {overview.isPending ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading the route…
        </div>
      ) : overview.isError ? (
        isNotAvailable(overview.error) ? (
          <NotAvailableYet what="The Hold in Earn route" />
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            The route&apos;s config could not be loaded.
            <Button
              size="sm"
              variant="outline"
              onClick={() => void overview.refetch()}
              className="cursor-pointer"
            >
              Retry
            </Button>
          </div>
        )
      ) : (
        <TierBalanceBody
          overview={overview.data}
          isRefreshing={overview.isFetching}
          onRefresh={() => void overview.refetch()}
          edits={edits}
          setEdits={setEdits}
          onSaved={(next) => {
            queryClient.setQueryData(TIER_BALANCE_OVERVIEW_KEY, next);
            setEdits({});
          }}
          onRan={() =>
            void queryClient.invalidateQueries({
              queryKey: TIER_BALANCE_OVERVIEW_KEY,
            })
          }
        />
      )}
    </ConfigSection>
  );
}

function TierBalanceBody({
  overview,
  isRefreshing,
  onRefresh,
  edits,
  setEdits,
  onSaved,
  onRan,
}: {
  overview: TierBalanceAdminOverview;
  isRefreshing: boolean;
  onRefresh: () => void;
  edits: Partial<TierBalanceDraft>;
  setEdits: React.Dispatch<React.SetStateAction<Partial<TierBalanceDraft>>>;
  onSaved: (next: TierBalanceAdminOverview) => void;
  onRan: () => void;
}) {
  const saved = overview.config;
  const form: TierBalanceDraft = { ...toTierBalanceDraft(saved), ...edits };
  const errors = tierBalanceFieldErrors(form);
  const hasErrors = Object.keys(errors).length > 0;
  const changes = hasErrors ? {} : tierBalanceChanges(form, saved);
  const changeCount = Object.keys(changes).length;
  const touched = Object.keys(edits).length > 0;

  const [previewed, setPreviewed] = useState<{
    changes: Partial<TierBalanceConfig>;
    preview: TierBalanceConfigPreview;
  } | null>(null);
  const [runAction, setRunAction] = useState<TierBalanceRunAction | null>(null);
  const [lastRun, setLastRun] = useState<TierBalanceRunResult | null>(null);

  const set = <K extends keyof TierBalanceDraft>(
    field: K,
    value: TierBalanceDraft[K],
  ) => setEdits((prev) => ({ ...prev, [field]: value }));

  const previewMutation = useMutation({
    mutationFn: async (body: Partial<TierBalanceConfig>) =>
      (await previewTierBalanceConfig(body)).data.data,
    onSuccess: (preview, body) => setPreviewed({ changes: body, preview }),
    // The API layer toasts the server's reason; the form stays as typed.
  });

  // Read from the form so every help line follows what the admin is typing.
  const lookback = errors.lookbackDays ? null : Number(form.lookbackDays);
  const lookbackText = lookback ? `the last ${count(lookback)} days` : "the lookback";
  const releasing = form.audience === "everyone" && saved.audience !== "everyone";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={saved.enabled ? "success" : "muted"}>
          {saved.enabled ? "Grants tiers" : "Grants no tier"}
        </Badge>
        <Badge variant={saved.collectionEnabled ? "info" : "warning"}>
          {saved.collectionEnabled ? "Measuring balances" : "Not measuring"}
        </Badge>
        <Badge variant={saved.audience === "everyone" ? "warning" : "muted"}>
          {saved.audience === "everyone"
            ? "Released to everyone"
            : "Team only"}
        </Badge>
        <Badge variant={saved.notificationsEnabled ? "info" : "muted"}>
          {saved.notificationsEnabled ? "Pushes on" : "Pushes off"}
        </Badge>
        {overview.updatedAt && (
          <span className="text-xs text-gray-500">
            Saved {formatDateTime(overview.updatedAt)}
          </span>
        )}
      </div>

      <StatusPanel
        overview={overview}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
      />

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="mb-1 text-sm font-semibold text-gray-900">Run now</h4>
        <p className="mb-3 text-xs text-gray-500">
          Both run on a schedule. Run them by hand after a change, or to check
          the route without waiting. Each asks before it starts.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setRunAction("sample")}
            className="cursor-pointer"
          >
            <Play />
            Run measurement now
          </Button>
          <Button
            variant="outline"
            onClick={() => setRunAction("evaluate")}
            className="cursor-pointer"
          >
            <Gauge />
            Evaluate now
          </Button>
        </div>
        {lastRun && (
          <p className="mt-3 flex gap-2 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {describeTierBalanceRun(lastRun)}
          </p>
        )}
      </div>

      <Group
        title="Route and audience"
        description="Whether the route grants tiers, measures balances and notifies, and who it covers."
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <SwitchField
            field="enabled"
            checked={form.enabled}
            onChange={(value) => set("enabled", value)}
            help="On: users the audience covers are granted Prime or Ultra once they qualify. Off: the route grants no tier."
          />
          <SwitchField
            field="collectionEnabled"
            checked={form.collectionEnabled}
            onChange={(value) => set("collectionEnabled", value)}
            help="Measures qualifying Earn balances on schedule. Keep it on to build history: the route can only judge days that were measured."
          />
          <SwitchField
            field="notificationsEnabled"
            checked={form.notificationsEnabled}
            onChange={(value) => set("notificationsEnabled", value)}
            help="Push notifications when a tier unlocks, enters grace, clears grace or ends on this route."
          />
          <div className="space-y-1.5">
            <Label htmlFor="tier-balance-audience">
              {TIER_BALANCE_FIELD_LABELS.audience}
              <InfoTooltip text="Team: only members tagged “Hold in Earn tier route” on Config → Internal team get the tier or see the route. Everyone: every user." />
            </Label>
            <select
              id="tier-balance-audience"
              value={form.audience}
              onChange={(event) =>
                set("audience", event.target.value as TierBalanceAudience)
              }
              className={SELECT_CLASS}
            >
              {(["team", "everyone"] as const).map((audience) => (
                <option key={audience} value={audience}>
                  {TIER_BALANCE_AUDIENCE_LABELS[audience]}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Tag members on{" "}
              <Link
                href="/internal-team"
                className="font-medium text-indigo-600 hover:underline"
              >
                Config → Internal team
              </Link>
              .
            </p>
          </div>
        </div>
        {form.audience === "everyone" && (
          <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {releasing ? (
                <>
                  <strong>Everyone releases the route to all users.</strong>{" "}
                  Once saved, every user who qualifies gets the tier through it
                  and the app shows the route to everyone, not only tagged team
                  members. The preview shows how many would hold a tier.
                </>
              ) : (
                <>
                  <strong>The route is released to all users.</strong> Switching
                  back to the team takes it away from everyone who is not
                  tagged.
                </>
              )}
            </p>
          </div>
        )}
      </Group>

      <Group
        title="Thresholds"
        description="The balance a tier needs. A tier's threshold is pinned when it unlocks; a lowered threshold applies to members already holding it."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField
            field="primeUsd"
            value={form.primeUsd}
            onChange={(value) => set("primeUsd", value)}
            error={errors.primeUsd}
            suffix="USD"
            help={`Every measured day in ${lookbackText} must be at or above this to unlock Prime.`}
          />
          <NumberField
            field="ultraUsd"
            value={form.ultraUsd}
            onChange={(value) => set("ultraUsd", value)}
            error={errors.ultraUsd}
            suffix="USD"
            help="The same for Ultra. Must be above the Prime threshold."
          />
        </div>
      </Group>

      <Group
        title="Timing"
        description="How long a balance has to hold, how much slack it gets, and how soon it can come back. Ultra and Prime are tracked separately: an Ultra member who drops below Ultra but stays above Prime goes through Ultra's grace and lands on Prime."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField
            field="lookbackDays"
            value={form.lookbackDays}
            onChange={(value) => set("lookbackDays", value)}
            error={errors.lookbackDays}
            suffix="days"
            help="The window a tier is judged on. A day's balance is the lowest measured that UTC day."
          />
          <NumberField
            field="maxMissingDays"
            value={form.maxMissingDays}
            onChange={(value) => set("maxMissingDays", value)}
            error={errors.maxMissingDays}
            suffix="days"
            maxOverride={lookback ? lookback - 1 : undefined}
            help={`Days in ${lookbackText} that may go unmeasured without blocking an unlock. Fewer than the lookback.`}
          />
          <NumberField
            field="graceDays"
            value={form.graceDays}
            onChange={(value) => set("graceDays", value)}
            error={errors.graceDays}
            suffix="days"
            help="Days below the threshold allowed in the lookback since unlock; the tier ends on the next day below. A drop caused only by price gets the same grace."
          />
          <NumberField
            field="reentryDays"
            value={form.reentryDays}
            onChange={(value) => set("reentryDays", value)}
            error={errors.reentryDays}
            suffix="days"
            help="After a tier ends on this route, how long before the route can unlock it again."
          />
        </div>
      </Group>

      <Group
        title="Measurement"
        description="Who is re-measured during the day, and how often."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField
            field="sampleIntervalMinutes"
            value={form.sampleIntervalMinutes}
            onChange={(value) => set("sampleIntervalMinutes", value)}
            error={errors.sampleIntervalMinutes}
            suffix="minutes"
            help="How often watched users are re-measured during the day."
          />
          <NumberField
            field="watchFloorUsd"
            value={form.watchFloorUsd}
            onChange={(value) => set("watchFloorUsd", value)}
            error={errors.watchFloorUsd}
            suffix="USD"
            help="Users at or above this balance, or with an open state on the route, are re-measured intraday at the interval above."
          />
        </div>
      </Group>

      <Group
        title="What counts"
        description="Vault shares (soUSD, soEUR, soETH, soBTC, soFUSE on Ethereum, Fuse and Base) in the Safe always count. These decide the rest."
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
          <SwitchField
            field="countCreditCollateral"
            checked={form.countCreditCollateral}
            onChange={(value) => set("countCreditCollateral", value)}
            help="Vault shares escrowed as Credit collateral count toward the balance."
          />
          <SwitchField
            field="subtractCreditDebt"
            checked={form.subtractCreditDebt}
            onChange={(value) => set("subtractCreditDebt", value)}
            help="Credit debt is subtracted from the balance."
          />
          <SwitchField
            field="countLockedFuse"
            checked={form.countLockedFuse}
            onChange={(value) => set("countLockedFuse", value)}
            help="soFUSE locked in the tier lock counts toward the balance."
          />
        </div>
      </Group>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => previewMutation.mutate(changes)}
          disabled={changeCount === 0 || hasErrors || previewMutation.isPending}
          className="cursor-pointer"
        >
          {previewMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Eye />
          )}
          Preview changes
        </Button>
        <Button
          variant="outline"
          onClick={() => setEdits({})}
          disabled={!touched || previewMutation.isPending}
          className="cursor-pointer"
        >
          <RotateCcw />
          Discard
        </Button>
        <span className="text-xs text-gray-500">
          {hasErrors
            ? "Fix the highlighted fields to preview."
            : changeCount > 0
              ? `${changeCount} unsaved change${changeCount === 1 ? "" : "s"}. Nothing is saved until you confirm the preview.`
              : "No changes."}
        </span>
      </div>

      {previewed && (
        <ConfigPreviewDialog
          changes={previewed.changes}
          preview={previewed.preview}
          onClose={() => setPreviewed(null)}
          onSaved={(next) => {
            setPreviewed(null);
            onSaved(next);
          }}
        />
      )}

      {runAction && (
        <RunNowDialog
          action={runAction}
          overview={overview}
          onClose={() => setRunAction(null)}
          onRan={(result) => {
            setLastRun(result);
            onRan();
          }}
        />
      )}
    </div>
  );
}

function StatusPanel({
  overview,
  isRefreshing,
  onRefresh,
}: {
  overview: TierBalanceAdminOverview;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { status, config } = overview;
  // Days of history a tier needs before anyone can unlock, from the saved
  // config: the lookback less the days it may go unmeasured.
  const neededDays = Math.max(config.lookbackDays - config.maxMissingDays, 0);
  const runs = [
    { label: "Last run", run: status.lastRun },
    { label: "Last full run", run: status.lastFullRun },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
        <CardAction>
          <Button
            size="xs"
            variant="ghost"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="cursor-pointer"
          >
            <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-5">
          <Stat
            label="Last evaluated day"
            value={status.lastEvaluatedDay ?? "Never"}
          />
          <Stat
            label="Next intraday sample"
            value={dateOrDash(status.nextSampleAt)}
          />
          <Stat
            label="First collected day"
            value={status.firstCollectedDay ?? "Not yet"}
          />
          <Stat
            label="History"
            value={`${count(status.historyDays)} day${status.historyDays === 1 ? "" : "s"}`}
          />
          <Stat
            label="Lookback"
            value={formatTierBalanceValue("lookbackDays", config.lookbackDays)}
          />
        </dl>

        {status.historyDays < neededDays && (
          <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Only {count(status.historyDays)} days collected. A tier needs{" "}
            {count(neededDays)} measured days of the{" "}
            {count(config.lookbackDays)}-day lookback (
            {count(config.maxMissingDays)} may go unmeasured), so nobody can
            unlock through the route yet.
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>State</TableHead>
              <TableHead className="text-right">
                Everyone measured
                <InfoTooltip text="Every measured user, access ignored: what releasing the route to everyone would look like today." />
              </TableHead>
              <TableHead className="text-right">
                Hold the tier now
                <InfoTooltip text="Users who actually hold the tier through the route now, access applied." />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STATE_ROWS.map(({ key, label }) => (
              <TableRow key={key}>
                <TableCell className="font-medium">{label}</TableCell>
                <TableCell className="text-right">
                  {count(status.counts[key])}
                </TableCell>
                <TableCell className="text-right">
                  {key === "prime" || key === "ultra"
                    ? count(status.granted[key])
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div>
          <h5 className="mb-1 text-xs font-medium text-gray-500 uppercase">
            Measurement runs
          </h5>
          <RunsTable rows={runs} />
        </div>
      </CardContent>
    </Card>
  );
}

function RunsTable({
  rows,
}: {
  rows: Array<{ label: string; run: TierBalanceRunView | null }>;
}) {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Day (UTC)</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead className="text-right">Scanned</TableHead>
            <TableHead className="text-right">Valued</TableHead>
            <TableHead className="text-right">Incomplete</TableHead>
            <TableHead className="text-right">Written</TableHead>
            <TableHead className="text-right">≥ watch floor</TableHead>
            <TableHead>By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ label, run }) =>
            run ? (
              <TableRow key={label}>
                <TableCell className="font-medium">{label}</TableCell>
                <TableCell>
                  {TIER_BALANCE_RUN_KIND[run.kind] ?? run.kind}
                  <span className="text-gray-400">
                    {" "}
                    · {TIER_BALANCE_RUN_TRIGGER[run.trigger] ?? run.trigger}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={TIER_BALANCE_RUN_STATUS[run.status]?.variant ?? "muted"}
                  >
                    {TIER_BALANCE_RUN_STATUS[run.status]?.label ?? run.status}
                  </Badge>
                </TableCell>
                <TableCell>{run.dayKey}</TableCell>
                <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                <TableCell>{dateOrDash(run.completedAt)}</TableCell>
                <TableCell className="text-right">
                  {count(run.stats.scanned)}
                </TableCell>
                <TableCell className="text-right">
                  {count(run.stats.valued)}
                </TableCell>
                <TableCell className="text-right">
                  {count(run.stats.incomplete)}
                </TableCell>
                <TableCell className="text-right">
                  {count(run.stats.written)}
                </TableCell>
                <TableCell className="text-right">
                  {count(run.stats.aboveFloor)}
                </TableCell>
                <TableCell className="text-gray-500">
                  {run.adminEmail ?? "—"}
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={label}>
                <TableCell className="font-medium">{label}</TableCell>
                <TableCell colSpan={11} className="text-gray-500">
                  None yet
                </TableCell>
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
      {rows.map(({ label, run }) =>
        run?.error ? (
          <p key={label} className="mt-2 text-xs text-red-600">
            {label}: {run.error}
          </p>
        ) : null,
      )}
    </>
  );
}

/** "soUSD $1.00 · soETH $3,412.20": the prices a run valued shares at. */
function pricesText(prices: TierBalanceRunView["prices"]): string | null {
  if (!prices) return null;
  const entries = Object.entries(prices);
  if (entries.length === 0) return null;
  return entries
    .map(([asset, price]) =>
      typeof price === "number"
        ? `${asset} ${tierBalanceUsd(price)}`
        : `${asset} ${price}`,
    )
    .join(" · ");
}

/**
 * Preview → Confirm for a config save. Shows the server's own reading of the
 * change and saves exactly the fields that were previewed.
 */
function ConfigPreviewDialog({
  changes,
  preview,
  onClose,
  onSaved,
}: {
  changes: Partial<TierBalanceConfig>;
  preview: TierBalanceConfigPreview;
  onClose: () => void;
  onSaved: (next: TierBalanceAdminOverview) => void;
}) {
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const { impact } = preview;
  const releasing =
    preview.proposed.audience === "everyone" &&
    preview.current.audience !== "everyone";

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await updateTierBalanceConfig({
          ...changes,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        })
      ).data.data,
    onSuccess: (next) => {
      toast.success("Hold in Earn route saved", {
        description: "The new settings apply from the next run.",
      });
      onSaved(next);
    },
    // The API layer toasts the server's reason; the dialog stays open.
  });

  const close = () => {
    if (!mutation.isPending) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review changes to the Hold in Earn route</DialogTitle>
          <DialogDescription>
            Computed by the server
            {impact.asOfDay ? ` against the readings for ${impact.asOfDay}` : ""}
            . Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        {preview.warnings.length > 0 && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <ul className="list-disc space-y-1 pl-4">
              {preview.warnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {releasing && (
          <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <p>
              <strong>This releases the route to every user.</strong> Users who
              qualify get the tier through it — not only tagged team members —
              and the app shows the route to everyone.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="tier-balance-release-ack"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <Label htmlFor="tier-balance-release-ack" className="text-xs">
                I understand this releases the route to all users.
              </Label>
            </div>
          </div>
        )}

        <div>
          <h5 className="mb-1 text-xs font-medium text-gray-500 uppercase">
            Changes
          </h5>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setting</TableHead>
                <TableHead>Now</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.changes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-gray-500">
                    The server sees no change.
                  </TableCell>
                </TableRow>
              ) : (
                preview.changes.map((change) => (
                  <TableRow key={change.field}>
                    <TableCell className="font-medium">
                      {TIER_BALANCE_FIELD_LABELS[change.field] ?? change.field}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatTierBalanceValue(change.field, change.from)}
                    </TableCell>
                    <TableCell>
                      {formatTierBalanceValue(change.field, change.to)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h5 className="mb-1 text-xs font-medium text-gray-500 uppercase">
              Everyone measured (access ignored)
            </h5>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STATE_ROWS.map(({ key, label }) => (
                  <BeforeAfterRow
                    key={key}
                    label={label}
                    before={impact.before[key]}
                    after={impact.after[key]}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h5 className="mb-1 text-xs font-medium text-gray-500 uppercase">
              Hold the tier (access applied)
            </h5>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(["ultra", "prime"] as const).map((tier) => (
                  <BeforeAfterRow
                    key={tier}
                    label={TIER_BALANCE_TIER_LABELS[tier]}
                    before={impact.grantedBefore[tier]}
                    after={impact.grantedAfter[tier]}
                  />
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-gray-500">
              Who actually gains or loses a tier through the route.
            </p>
          </div>
        </div>

        <div>
          <h5 className="mb-1 text-xs font-medium text-gray-500 uppercase">
            Affected users
          </h5>
          <p className="mb-2 text-xs text-gray-600">
            {impact.changed === 0
              ? "No user's route tier changes."
              : `${count(impact.changed)} ${
                  impact.changed === 1 ? "user's route tier changes" : "users' route tiers change"
                } (access ignored)${
                  impact.users.length < impact.changed
                    ? `; the first ${count(impact.users.length)} are listed`
                    : ""
                }.`}
          </p>
          {impact.users.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Route tier</TableHead>
                    <TableHead className="text-right">Lowest</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {impact.users.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <UserLink userId={user.userId} username={user.username} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Badge variant={TIER_BALANCE_TIER_VARIANT[user.before]}>
                            {TIER_BALANCE_TIER_LABELS[user.before]}
                          </Badge>
                          →
                          <Badge variant={TIER_BALANCE_TIER_VARIANT[user.after]}>
                            {TIER_BALANCE_TIER_LABELS[user.after]}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {tierBalanceUsd(user.lowestUsd)}
                      </TableCell>
                      <TableCell className="text-right">
                        {tierBalanceUsd(user.currentUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tier-balance-reason">Reason</Label>
          <Textarea
            id="tier-balance-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="e.g. Release to everyone after the team pilot"
            disabled={mutation.isPending}
          />
          <p className="text-muted-foreground text-xs">
            Optional. Saved with the change and your name.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={close}
            disabled={mutation.isPending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant={releasing ? "destructive" : "default"}
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              preview.changes.length === 0 ||
              (releasing && !acknowledged)
            }
            className="cursor-pointer"
          >
            {mutation.isPending && <Loader2 className="animate-spin" />}
            {releasing ? "Release to everyone" : "Confirm and save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BeforeAfterRow({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after: number;
}) {
  const delta = after - before;
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right text-gray-500">{count(before)}</TableCell>
      <TableCell className="text-right">
        {count(after)}
        {delta !== 0 && (
          <span
            className={cn(
              "ml-1 text-xs",
              delta > 0 ? "text-emerald-700" : "text-red-700",
            )}
          >
            ({delta > 0 ? "+" : "−"}
            {count(Math.abs(delta))})
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Confirm, then run a measurement or the evaluation, then say what it did. */
function RunNowDialog({
  action,
  overview,
  onClose,
  onRan,
}: {
  action: TierBalanceRunAction;
  overview: TierBalanceAdminOverview;
  onClose: () => void;
  onRan: (result: TierBalanceRunResult) => void;
}) {
  const [result, setResult] = useState<TierBalanceRunResult | null>(null);
  const { config, status } = overview;

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await runTierBalance(
          action === "sample" ? { action, scope: "full" } : { action },
        )
      ).data.data,
    onSuccess: (data) => {
      setResult(data);
      onRan(data);
      toast.success(
        action === "sample" ? "Measurement finished" : "Evaluation finished",
      );
    },
    // The API layer toasts the server's reason; the dialog stays open to retry.
  });

  const close = () => {
    if (!mutation.isPending) onClose();
  };

  const prices = result?.run ? pricesText(result.run.prices) : null;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="sm:max-w-xl">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {action === "sample" ? "Measurement run" : "Evaluation run"}
              </DialogTitle>
              <DialogDescription>{describeTierBalanceRun(result)}</DialogDescription>
            </DialogHeader>
            {result.evaluated && (
              <dl className="grid grid-cols-3 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs">
                <Stat label="Users" value={count(result.evaluated.users)} />
                <Stat label="Unlocked" value={count(result.evaluated.unlocked)} />
                <Stat label="Ended" value={count(result.evaluated.ended)} />
                <Stat
                  label="Grace started"
                  value={count(result.evaluated.graceStarted)}
                />
                <Stat
                  label="Grace cleared"
                  value={count(result.evaluated.graceCleared)}
                />
              </dl>
            )}
            {prices && (
              <p className="text-xs text-gray-500">Valued at: {prices}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={close} className="cursor-pointer">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {action === "sample"
                  ? "Measure every user's Earn balance now?"
                  : "Evaluate the route now?"}
              </DialogTitle>
              <DialogDescription>
                {action === "sample"
                  ? "Runs a full measurement: reads every Safe's qualifying Earn balance from the chain and records it for today. It can take a while on a large user base."
                  : "Applies the route's rules to the measured days now, instead of at the scheduled time."}
              </DialogDescription>
            </DialogHeader>

            {action === "sample" ? (
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  A day&apos;s balance is its lowest reading, so a lower reading
                  now can lower today&apos;s figure for a user.
                </li>
                <li>
                  It records readings; tiers are granted or ended by the
                  evaluation.
                </li>
                {!config.collectionEnabled && (
                  <li className="text-amber-700">
                    Measuring is switched off in the saved config.
                  </li>
                )}
                <li>
                  Last full run:{" "}
                  {status.lastFullRun
                    ? `${status.lastFullRun.dayKey}, ${(
                        TIER_BALANCE_RUN_STATUS[status.lastFullRun.status]?.label ??
                        status.lastFullRun.status
                      ).toLowerCase()}`
                    : "never"}
                  .
                </li>
              </ul>
            ) : (
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>
                  Users who qualify are unlocked, users below their threshold
                  enter grace or lose the tier, and users back above clear
                  grace — for{" "}
                  <strong>
                    {config.audience === "everyone"
                      ? "every user"
                      : "tagged internal team members only"}
                  </strong>
                  .
                </li>
                {!config.enabled && (
                  <li className="text-amber-700">
                    The route is switched off in the saved config, so it grants
                    no tier.
                  </li>
                )}
                <li>
                  {config.notificationsEnabled
                    ? "Push notifications are on: users whose tier changes are notified."
                    : "Push notifications are off: nobody is notified."}
                </li>
                <li>
                  Last evaluated day: {status.lastEvaluatedDay ?? "never"}. Hold
                  the tier now: Ultra {count(status.granted.ultra)} · Prime{" "}
                  {count(status.granted.prime)}.
                </li>
              </ul>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={close}
                disabled={mutation.isPending}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="cursor-pointer"
              >
                {mutation.isPending && <Loader2 className="animate-spin" />}
                {action === "sample" ? "Run measurement" : "Evaluate now"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
