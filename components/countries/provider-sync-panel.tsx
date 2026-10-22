"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  FileCog,
  Loader2,
  SearchCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  confirmCountryAccessProvider,
  createCountryAccessDiditQuestionnaire,
  verifyCountryAccessDiditLink,
} from "@/lib/api";
import {
  COUNTRY_LIST_LABELS,
  countStates,
  DIDIT_CONSOLE_URL,
  sortByName,
  SUMSUB_DASHBOARD_URL,
  summarizeNames,
} from "@/lib/country-access";
import type { CountryAccessList } from "@/types/country-access";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { CopyableValue } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";

/**
 * What still has to happen on the provider's side for the countries just
 * added to a list to go live, and the buttons for the parts we can do.
 *
 * Didit (Rain lists): generating the questionnaire from the stored list is
 * automated; linking it to the workflow is a developer's step in the Didit
 * console — Didit's API can only do it by rewriting the workflow's whole
 * configuration, which is not a risk worth taking on a live KYC flow — and
 * the link is then read back from Didit to confirm it.
 *
 * Sumsub (Wirex): levels have no API, so a developer checks the level accepts
 * the new countries and records it here.
 */
export function ProviderSyncPanel({
  list,
  nameOf,
}: {
  list: CountryAccessList;
  nameOf: (code: string) => string;
}) {
  if (list.provider.kind === "didit") {
    return <DiditPanel list={list} nameOf={nameOf} />;
  }
  if (list.provider.kind === "sumsub") {
    return <SumsubPanel list={list} nameOf={nameOf} />;
  }
  return null;
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ queryKey: ["country-access"] });
}

/** "Indonesia, Türkiye" and "3 US states" — what is waiting. */
function pendingSummary(
  list: CountryAccessList,
  nameOf: (code: string) => string,
): string {
  const parts: string[] = [];
  if (list.pendingCountries.length) {
    parts.push(
      summarizeNames(sortByName(list.pendingCountries, nameOf).map(nameOf), 6),
    );
  }
  const states = countStates(list.pendingStates);
  if (states) parts.push(`${states} US state${states === 1 ? "" : "s"}`);
  return parts.join(" and ");
}

function SyncedLine({ list }: { list: CountryAccessList }) {
  const sync = list.providerSync;
  if (!sync?.confirmedAt) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-700">
        <CheckCircle2 className="size-4" />
        Nothing waiting on the provider.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-emerald-700">
      <CheckCircle2 className="size-4" />
      In sync — confirmed by {sync.confirmedBy} on{" "}
      {new Date(sync.confirmedAt).toLocaleString()}
      {sync.confirmedVia === "didit_workflow" ? " (read back from Didit)" : ""}.
    </p>
  );
}

function DiditPanel({
  list,
  nameOf,
}: {
  list: CountryAccessList;
  nameOf: (code: string) => string;
}) {
  const refresh = useRefresh();
  const [confirmingManual, setConfirmingManual] = useState(false);
  const [note, setNote] = useState("");
  // Rebuilding while in sync: for a form that drifted before this page
  // existed, or one someone edited by hand in the Didit console.
  const [rebuilding, setRebuilding] = useState(false);
  const sync = list.providerSync;
  const waiting = pendingSummary(list, nameOf);
  const questionnaire = sync?.questionnaireUuid;
  // A questionnaire kept after confirmation is the one already live.
  const awaitingLink = !!questionnaire && !!sync?.outOfSync;

  const generate = useMutation({
    mutationFn: async () =>
      (await createCountryAccessDiditQuestionnaire(list.key)).data.data,
    onSuccess: (result) => {
      toast.success("Didit questionnaire created", {
        description: `Link ${result.questionnaireUuid} to the workflow in the Didit console.`,
      });
      refresh();
    },
  });

  const verify = useMutation({
    mutationFn: async () =>
      (await verifyCountryAccessDiditLink(list.key)).data.data,
    onSuccess: (result) => {
      if (result.linked) {
        toast.success("Linked — the new countries are live", {
          description: `${result.workflowLabel ?? result.workflowId} runs the new questionnaire.`,
        });
      } else {
        toast.warning("Not linked yet", {
          description: result.foundQuestionnaireUuids.length
            ? `The workflow still runs ${result.foundQuestionnaireUuids.join(", ")}.`
            : "Didit did not report a questionnaire on the workflow. If you have linked it, confirm by hand.",
        });
      }
      refresh();
    },
  });

  const confirm = useMutation({
    mutationFn: async () =>
      (await confirmCountryAccessProvider(list.key, note.trim() || undefined))
        .data.data,
    onSuccess: () => {
      toast.success("Marked as in sync with Didit");
      setConfirmingManual(false);
      setNote("");
      refresh();
    },
    onError: () => setConfirmingManual(false),
  });

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <FileCog className="size-4 text-gray-500" />
        <p className="text-sm font-medium text-gray-900">Didit questionnaire</p>
        {list.provider.workflowId ? (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            workflow
            <CopyableValue
              value={list.provider.workflowId}
              label="Workflow ID"
            />
          </span>
        ) : (
          <span className="text-xs text-red-700">
            No workflow configured in this environment
          </span>
        )}
      </div>

      {sync?.outOfSync ? (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            {waiting ? (
              <p>
                <span className="font-medium">Not live yet: {waiting}.</span>{" "}
                Our gate lets these through, but applicants can&apos;t pick them
                in the Didit form until a developer links a questionnaire
                generated from this list.
              </p>
            ) : (
              <p>
                The Didit form still offers what was removed from this list. Our
                gate already refuses those, so this is tidying up — but do it
                with the next change.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <SyncedLine list={list} />
          {!rebuilding ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setRebuilding(true)}
            >
              Rebuild the questionnaire anyway
            </Button>
          ) : null}
        </div>
      )}

      {sync?.outOfSync || awaitingLink || rebuilding ? (
        <ol className="space-y-3 text-sm">
          <li className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="font-medium text-gray-700 sm:w-64">
              1. Generate a questionnaire from this list
            </span>
            <Button
              type="button"
              size="sm"
              variant={questionnaire ? "outline" : "default"}
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? <Loader2 className="animate-spin" /> : null}
              {questionnaire ? "Generate again" : "Generate questionnaire"}
            </Button>
            {questionnaire ? (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                Latest:
                <CopyableValue value={questionnaire} label="Questionnaire ID" />
              </span>
            ) : null}
          </li>
          <li className="flex flex-col gap-1 sm:flex-row sm:items-start">
            <span className="font-medium text-gray-700 sm:w-64">
              2. A developer links it in Didit
            </span>
            <span className="text-gray-600">
              <a
                href={DIDIT_CONSOLE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
              >
                Didit console <ExternalLink className="size-3" />
              </a>{" "}
              → Workflows → the workflow above → Questionnaire step → pick the
              questionnaire from step 1 → Publish. Not automated: Didit&apos;s
              API can only do this by rewriting the workflow&apos;s whole
              configuration.
            </span>
          </li>
          <li className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="font-medium text-gray-700 sm:w-64">
              3. Check it and go live
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => verify.mutate()}
                disabled={
                  verify.isPending ||
                  !questionnaire ||
                  !list.provider.canVerifyLink
                }
                title={
                  questionnaire ? undefined : "Generate a questionnaire first"
                }
              >
                {verify.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <SearchCheck />
                )}
                Check link in Didit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmingManual(true)}
                disabled={confirm.isPending}
              >
                Mark as done
              </Button>
            </div>
          </li>
        </ol>
      ) : null}

      <ConfirmationModal
        isOpen={confirmingManual}
        title="Mark Didit as up to date?"
        confirmText={confirm.isPending ? "Saving…" : "Mark as done"}
        onCancel={() => setConfirmingManual(false)}
        onConfirm={() => {
          if (!confirm.isPending) confirm.mutate();
        }}
        message={
          <div className="space-y-3 text-sm">
            <p>
              Only once the {COUNTRY_LIST_LABELS[list.key]} workflow runs a
              questionnaire generated from this list.
              {waiting ? ` ${waiting} will stop showing as not live.` : ""}{" "}
              Prefer &ldquo;Check link in Didit&rdquo;, which confirms it from
              Didit itself.
            </p>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What was done (optional)"
              maxLength={500}
              aria-label="What was done"
            />
          </div>
        }
      />
    </div>
  );
}

function SumsubPanel({
  list,
  nameOf,
}: {
  list: CountryAccessList;
  nameOf: (code: string) => string;
}) {
  const refresh = useRefresh();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const waiting = pendingSummary(list, nameOf);
  const level = list.provider.levelName ?? "Wirex";

  const confirm = useMutation({
    mutationFn: async () =>
      (await confirmCountryAccessProvider(list.key, note.trim() || undefined))
        .data.data,
    onSuccess: () => {
      toast.success("Marked as in sync with Sumsub");
      setConfirming(false);
      setNote("");
      refresh();
    },
    onError: () => setConfirming(false),
  });

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <FileCog className="size-4 text-gray-500" />
        <p className="text-sm font-medium text-gray-900">Sumsub level</p>
        <span className="text-xs text-gray-500">
          <CopyableValue value={level} label="Level name" />
        </span>
      </div>

      {waiting ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-start">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">
            <span className="font-medium">Not confirmed yet: {waiting}.</span>{" "}
            Our gate lets these through, but a developer has to check in the{" "}
            <a
              href={SUMSUB_DASHBOARD_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
            >
              Sumsub dashboard <ExternalLink className="size-3" />
            </a>{" "}
            that the &ldquo;{level}&rdquo; level accepts residents and documents
            from them, and that Wirex onboards them. Sumsub has no API for
            levels, so this can&apos;t be done from here.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-white"
            onClick={() => setConfirming(true)}
            disabled={confirm.isPending}
          >
            Mark Sumsub as updated
          </Button>
        </div>
      ) : (
        <SyncedLine list={list} />
      )}

      <ConfirmationModal
        isOpen={confirming}
        title="Mark Sumsub as updated?"
        confirmText={confirm.isPending ? "Saving…" : "Mark as updated"}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (!confirm.isPending) confirm.mutate();
        }}
        message={
          <div className="space-y-3 text-sm">
            <p>
              Only once a developer has confirmed the &ldquo;{level}&rdquo;
              level accepts {waiting || "the added countries"}. They will stop
              showing as not live.
            </p>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What was checked (optional)"
              maxLength={500}
              aria-label="What was checked"
            />
          </div>
        }
      />
    </div>
  );
}
