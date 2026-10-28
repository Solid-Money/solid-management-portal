"use client";

import { ChevronRight, History } from "lucide-react";

import { sortByName } from "@/lib/country-access";
import type {
  CountryAccessHistoryAction,
  CountryAccessHistoryEntry,
  StatesByCountry,
} from "@/types/country-access";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const ACTION_LABELS: Record<CountryAccessHistoryAction, string> = {
  updated: "Edited",
  reset_to_defaults: "Reset to code defaults",
  questionnaire_created: "Generated a Didit questionnaire",
  provider_confirmed: "Confirmed the provider is up to date",
};

/**
 * Who changed this list, when, and what — the answer to "who closed Turkey?"
 * without a log search. Folded away like the sections around it.
 */
export function ListHistory({
  history,
  nameOf,
}: {
  history: CountryAccessHistoryEntry[];
  nameOf: (code: string) => string;
}) {
  if (history.length === 0) return null;

  return (
    <Collapsible
      defaultOpen={false}
      className="rounded-md border border-gray-200"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
        <ChevronRight
          className="size-4 text-gray-400 transition-transform group-data-[state=open]:rotate-90"
          aria-hidden
        />
        <History className="size-4 text-gray-400" aria-hidden />
        Recent changes ({history.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-gray-100 border-t border-gray-100 text-sm">
          {history.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="space-y-0.5 px-3 py-2">
              <p className="text-gray-900">
                <span className="font-medium">
                  {ACTION_LABELS[entry.action]}
                </span>{" "}
                <span className="text-gray-500">
                  by {entry.by} · {new Date(entry.at).toLocaleString()}
                </span>
              </p>
              {entry.addedCountries?.length ? (
                <p className="text-emerald-700">
                  +{" "}
                  {sortByName(entry.addedCountries, nameOf)
                    .map(nameOf)
                    .join(", ")}
                </p>
              ) : null}
              {entry.removedCountries?.length ? (
                <p className="text-red-700">
                  −{" "}
                  {sortByName(entry.removedCountries, nameOf)
                    .map(nameOf)
                    .join(", ")}
                </p>
              ) : null}
              <StateLines states={entry.addedStates} sign="+" nameOf={nameOf} />
              <StateLines
                states={entry.removedStates}
                sign="−"
                nameOf={nameOf}
              />
              {entry.questionnaireUuid ? (
                <p className="font-mono text-xs text-gray-500">
                  questionnaire {entry.questionnaireUuid}
                </p>
              ) : null}
              {entry.note ? (
                <p className="text-gray-500">&ldquo;{entry.note}&rdquo;</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StateLines({
  states,
  sign,
  nameOf,
}: {
  states?: StatesByCountry;
  sign: "+" | "−";
  nameOf: (code: string) => string;
}) {
  if (!states) return null;
  return (
    <>
      {Object.entries(states).map(([country, names]) => (
        <p
          key={`${sign}${country}`}
          className={sign === "+" ? "text-emerald-700" : "text-red-700"}
        >
          {sign} {nameOf(country)} states: {names.join(", ")}
        </p>
      ))}
    </>
  );
}
