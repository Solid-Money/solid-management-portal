"use client";

import { Fragment, useState } from "react";
import { isAxiosError } from "axios";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Play,
  ScanSearch,
} from "lucide-react";
import { toast } from "sonner";

import { NudgeReviewDialog } from "@/components/nudges/nudge-review-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useApplyNudgeMigration,
  useDryRunNudgeMigration,
  useNudgeBoard,
  useNudgeMigrations,
} from "@/hooks/use-nudges";
import { formatChangeValue } from "@/lib/nudges";
import { cn } from "@/lib/utils";
import type {
  NudgeMigrationAction,
  NudgeMigrationId,
  NudgeMigrationPlan,
  NudgeMigrationResult,
  NudgeMigrationView,
} from "@/types/nudges";

const ACTION_VARIANT: Record<
  NudgeMigrationAction,
  "success" | "info" | "muted" | "warning"
> = {
  create: "success",
  update: "info",
  unchanged: "muted",
  skip: "warning",
};

/** Used until the nudges board (which carries the real limits) has loaded. */
const FALLBACK_REASON = { min: 5, max: 500 };

/**
 * Scripts → Automated nudges migrations: move the nudges from code into the
 * database, then apply the 24 Nov nudge map. Each is previewed with a dry run
 * (every nudge it creates or changes, field by field) and applied only as
 * previewed: apply sends back the plan's hash, and the backend refuses it if
 * anything moved since.
 */
export function NudgeMigrations() {
  const { data: migrations, isLoading, error } = useNudgeMigrations();

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />;
  }
  if (error || !migrations) {
    return <p className="text-sm text-red-600">Failed to load the migrations.</p>;
  }

  return (
    <div className="space-y-4">
      {migrations.map((migration) => (
        <MigrationCard
          key={migration.id}
          migration={migration}
          all={migrations}
        />
      ))}
    </div>
  );
}

function MigrationCard({
  migration,
  all,
}: {
  migration: NudgeMigrationView;
  all: NudgeMigrationView[];
}) {
  const board = useNudgeBoard();
  const dryRun = useDryRunNudgeMigration();
  const apply = useApplyNudgeMigration();
  const [plan, setPlan] = useState<NudgeMigrationPlan | null>(null);
  const [result, setResult] = useState<NudgeMigrationResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const missing = migration.requires.filter(
    (id) => !all.find((m) => m.id === id)?.appliedAt
  );
  const titleOf = (id: NudgeMigrationId) =>
    all.find((m) => m.id === id)?.title ?? id;
  const reasonLimits = board.data
    ? {
        min: board.data.catalog.limits.reasonMin,
        max: board.data.catalog.limits.reasonMax,
      }
    : FALLBACK_REASON;
  const changing = plan ? plan.summary.create + plan.summary.update : 0;

  const runDryRun = () => {
    setResult(null);
    dryRun.mutate(migration.id, { onSuccess: setPlan });
  };

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
            {migration.title}
            {migration.appliedAt ? (
              <Badge variant="success">
                <CheckCircle2 />
                applied
              </Badge>
            ) : (
              <Badge variant="muted">not applied</Badge>
            )}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{migration.description}</p>
          {migration.appliedAt ? (
            <p className="mt-1 text-xs text-gray-500">
              Applied {new Date(migration.appliedAt).toLocaleString()}
              {migration.appliedBy ? ` by ${migration.appliedBy}` : ""}. Running
              it again only applies what changed since.
            </p>
          ) : null}
          {migration.requires.length > 0 ? (
            <p
              className={cn(
                "mt-1 text-xs",
                missing.length > 0 ? "text-amber-700" : "text-gray-500"
              )}
            >
              Needs first: {migration.requires.map(titleOf).join(", ")}
              {missing.length > 0 ? " (not applied yet)" : " (done)"}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={runDryRun}
            disabled={dryRun.isPending || apply.isPending}
          >
            {dryRun.isPending ? <Loader2 className="animate-spin" /> : <ScanSearch />}
            Dry run
          </Button>
          <Button
            onClick={() => setConfirming(true)}
            disabled={
              !plan || missing.length > 0 || apply.isPending || dryRun.isPending
            }
            title={
              !plan
                ? "Run a dry run first"
                : missing.length > 0
                  ? "Apply the migrations it needs first"
                  : undefined
            }
          >
            {apply.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            Apply
          </Button>
        </div>
      </div>

      {result ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Applied {new Date(result.appliedAt).toLocaleString()} by {result.appliedBy}:{" "}
          {result.created} created, {result.updated} updated, {result.unchanged}{" "}
          unchanged, {result.skipped} skipped.
        </p>
      ) : null}

      {plan ? <PlanView plan={plan} /> : null}

      <NudgeReviewDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Apply: ${migration.title}`}
        description={
          plan
            ? `As the dry run of ${new Date(plan.generatedAt).toLocaleTimeString()} showed: ${plan.summary.create} created, ${plan.summary.update} updated, ${plan.summary.unchanged} unchanged, ${plan.summary.skip} skipped. Live nudges start using the new values within a minute.`
            : ""
        }
        changes={[]}
        warnings={plan?.warnings ?? []}
        errors={
          plan && changing === 0
            ? ["Nothing to apply: the dry run found no changes."]
            : []
        }
        reasonMin={reasonLimits.min}
        reasonMax={reasonLimits.max}
        saving={apply.isPending}
        confirmLabel={`Apply ${changing} change${changing === 1 ? "" : "s"}`}
        onConfirm={(reason) => {
          if (!plan) return;
          apply.mutate(
            { id: migration.id, input: { planHash: plan.planHash, reason } },
            {
              onSuccess: (applied) => {
                setConfirming(false);
                setPlan(null);
                setResult(applied);
                toast.success(`${migration.title}: applied.`);
              },
              onError: (applyError) => {
                if (isAxiosError(applyError) && applyError.response?.status === 409) {
                  setConfirming(false);
                  setPlan(null);
                  toast.error(
                    "The data changed since the dry run. Run it again and review the new plan."
                  );
                }
              },
            }
          );
        }}
      />
    </div>
  );
}

function PlanView({ plan }: { plan: NudgeMigrationPlan }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const items = showUnchanged
    ? plan.items
    : plan.items.filter((item) => item.action !== "unchanged");

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">
          Dry run, {new Date(plan.generatedAt).toLocaleString()}:
        </span>
        {(Object.keys(ACTION_VARIANT) as NudgeMigrationAction[]).map((action) => (
          <Badge key={action} variant={ACTION_VARIANT[action]}>
            {plan.summary[action]} {action}
          </Badge>
        ))}
      </div>

      {plan.warnings.length > 0 ? (
        <ul className="list-disc space-y-0.5 rounded-md border border-amber-200 bg-amber-50 py-2 pr-3 pl-7 text-sm text-amber-800">
          {plan.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${plan.id}-show-unchanged`}
          checked={showUnchanged}
          onCheckedChange={(checked) => setShowUnchanged(checked === true)}
        />
        <Label htmlFor={`${plan.id}-show-unchanged`} className="text-sm text-gray-600">
          Show unchanged ({plan.summary.unchanged})
        </Label>
      </div>

      <div className="max-h-[480px] overflow-y-auto rounded-md border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Nudge</TableHead>
              <TableHead className="w-28">Action</TableHead>
              <TableHead className="w-24">Fields</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                  Nothing to change.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const open = expanded.has(item.key);
                const expandable = item.changes.length > 0;
                return (
                  <Fragment key={item.key}>
                    <TableRow
                      className={cn(expandable && "cursor-pointer")}
                      onClick={() => expandable && toggle(item.key)}
                    >
                      <TableCell>
                        {expandable ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              // The row toggles too; don't toggle twice.
                              e.stopPropagation();
                              toggle(item.key);
                            }}
                            aria-expanded={open}
                            aria-label={`${open ? "Hide" : "Show"} the changes to ${item.name}`}
                            className="flex cursor-pointer items-center rounded focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                          >
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 text-gray-400 transition-transform",
                                open && "rotate-90"
                              )}
                            />
                          </button>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="block text-sm text-gray-900">{item.name}</span>
                        <span className="font-mono text-xs text-gray-400">{item.key}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[item.action]}>{item.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {item.changes.length || "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-normal text-gray-600">
                        {item.note ?? ""}
                      </TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableCell />
                        <TableCell colSpan={4} className="whitespace-normal">
                          <ul className="space-y-0.5 text-xs text-gray-600">
                            {item.changes.map((change) => (
                              <li key={change.field} className="break-words">
                                <span className="font-mono">{change.field}</span>:{" "}
                                <span className="text-gray-400 line-through">
                                  {formatChangeValue(change.from)}
                                </span>{" "}
                                →{" "}
                                <span className="text-gray-900">
                                  {formatChangeValue(change.to)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
