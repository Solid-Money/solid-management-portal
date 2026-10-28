"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { updateCountryAccessList } from "@/lib/api";
import {
  COUNTRY_LIST_LABELS,
  countryFlag,
  matchesCountry,
  countryKeywords,
  countStates,
  diffCodes,
  diffStates,
  sortByName,
  summarizeNames,
} from "@/lib/country-access";
import type {
  CountryAccessList,
  CountryOption,
  StatesByCountry,
} from "@/types/country-access";
import { CountryChip } from "@/components/countries/country-chip";
import { MultiSelect } from "@/components/countries/multi-select";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";

/** Above this many, the list gets a filter box. */
const FILTER_THRESHOLD = 16;

/**
 * Edit one country list: pick countries by name from a searchable picker,
 * remove them from the chips, and — on the Rain lists — choose the US states.
 * Nothing is saved until "Review & save", which spells out what goes live at
 * once and what waits on a provider.
 *
 * Remounted by the page whenever the saved list changes (keyed on its
 * `updatedAt`), so the draft always starts from what is stored.
 */
export function CountryListEditor({
  list,
  catalog,
  stateCatalog,
  nameOf,
  pendingWarning,
  addedEffect,
  removedEffect,
}: {
  list: CountryAccessList;
  catalog: CountryOption[];
  stateCatalog: Record<string, string[]>;
  nameOf: (code: string) => string;
  /**
   * Shown on a country that is on the list but not live yet — what a
   * developer still has to do. Absent for a list nothing else has to learn
   * about (TransFi's).
   */
  pendingWarning?: string;
  /** What adding a country does, for the confirmation. */
  addedEffect: string;
  /** What removing one does, for the confirmation. */
  removedEffect: string;
}) {
  const queryClient = useQueryClient();
  const [countries, setCountries] = useState<string[]>(list.countries);
  const [states, setStates] = useState<StatesByCountry>(list.states);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const selected = useMemo(() => new Set(countries), [countries]);
  const blocked = useMemo(
    () => new Map(list.blocked.map((n) => [n.code, n.reason])),
    [list.blocked],
  );
  const overridden = useMemo(
    () => new Map(list.overridden.map((n) => [n.code, n.reason])),
    [list.overridden],
  );
  const pending = useMemo(
    () => new Set(list.pendingCountries),
    [list.pendingCountries],
  );

  const countryDiff = diffCodes(list.countries, countries);
  const stateDiff = list.supportsStates
    ? diffStates(list.states, states)
    : { added: {}, removed: {} };
  const statesChanged =
    countStates(stateDiff.added) + countStates(stateDiff.removed) > 0;
  const dirty =
    countryDiff.added.length > 0 ||
    countryDiff.removed.length > 0 ||
    statesChanged;

  // An empty state list reads as "every state" to routing, so the backend
  // refuses one; say so here instead of after the round trip.
  const missingStates = list.supportsStates
    ? Object.keys(stateCatalog).filter(
        (country) => selected.has(country) && !states[country]?.length,
      )
    : [];

  const added = new Set(countryDiff.added);
  const shown = sortByName(countries, nameOf).filter((code) =>
    matchesCountry(code, nameOf(code), filter),
  );

  const options = useMemo(
    () =>
      catalog.map((country) => ({
        value: country.code,
        label: country.name,
        hint: country.code,
        icon: countryFlag(country.code),
        keywords: countryKeywords(country.code, country.name),
        disabledReason: blocked.has(country.code)
          ? "Can't be added"
          : undefined,
      })),
    [catalog, blocked],
  );

  const toggleCountry = (code: string) =>
    setCountries((current) =>
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
    );

  const toggleState = (country: string, name: string) =>
    setStates((current) => {
      const names = current[country] ?? [];
      const next = names.includes(name)
        ? names.filter((s) => s !== name)
        : [...names, name];
      const order = stateCatalog[country] ?? [];
      return {
        ...current,
        [country]: order.filter((s) => next.includes(s)),
      };
    });

  const discard = () => {
    setCountries(list.countries);
    setStates(list.states);
    setNote("");
  };

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await updateCountryAccessList(list.key, {
          countries,
          ...(list.supportsStates && { states: dropEmpty(states) }),
          ...(list.updatedAt && { expectedUpdatedAt: list.updatedAt }),
          ...(note.trim() && { note: note.trim() }),
        })
      ).data.data,
    onSuccess: () => {
      toast.success(`${COUNTRY_LIST_LABELS[list.key]} updated`);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["country-access"] });
    },
    onError: () => setConfirming(false),
  });

  const warningFor = (code: string) => {
    if (!pendingWarning) return undefined;
    if (added.has(code)) return `New — ${pendingWarning}`;
    return pending.has(code) ? pendingWarning : undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <MultiSelect
          options={options}
          selected={selected}
          onToggle={toggleCountry}
          placeholder="Add or remove countries…"
          searchPlaceholder="Search by country name or code"
          emptyText="No country matches."
        />
        {countries.length > FILTER_THRESHOLD ? (
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter these ${countries.length} countries`}
            className="sm:w-64"
            aria-label="Filter the countries on this list"
          />
        ) : null}
      </div>

      {countries.length === 0 ? (
        <p className="text-sm text-gray-500">No countries on this list.</p>
      ) : (
        <div className="flex max-h-96 flex-wrap gap-1.5 overflow-y-auto">
          {shown.map((code) => (
            <CountryChip
              key={code}
              label={nameOf(code)}
              code={code}
              flag={countryFlag(code)}
              tone={added.has(code) ? "added" : "default"}
              warning={warningFor(code)}
              info={overridden.get(code)}
              onRemove={() => toggleCountry(code)}
            />
          ))}
          {shown.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing matches the filter.</p>
          ) : null}
        </div>
      )}

      {countryDiff.removed.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-red-700">
            Will be removed when you save
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sortByName(countryDiff.removed, nameOf).map((code) => (
              <CountryChip
                key={code}
                label={nameOf(code)}
                code={code}
                flag={countryFlag(code)}
                tone="removed"
                onRestore={() => toggleCountry(code)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {list.supportsStates
        ? Object.entries(stateCatalog)
            .filter(([country]) => selected.has(country))
            .map(([country, allStates]) => (
              <StatesEditor
                key={country}
                countryName={nameOf(country)}
                allStates={allStates}
                states={states[country] ?? []}
                savedStates={list.states[country] ?? []}
                pendingStates={list.pendingStates[country] ?? []}
                pendingWarning={pendingWarning}
                onToggle={(name) => toggleState(country, name)}
              />
            ))
        : null}

      {list.blocked.length > 0 ? (
        <Collapsible defaultOpen={false} className="text-xs text-gray-500">
          <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 hover:text-gray-700">
            <ChevronRight
              className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
              aria-hidden
            />
            {list.blocked.length === 1
              ? "1 country can't be added here"
              : `${list.blocked.length} countries can't be added here`}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-1 space-y-0.5 pl-5">
              {sortByName(
                list.blocked.map((n) => n.code),
                nameOf,
              ).map((code) => (
                <li key={code}>
                  {countryFlag(code)} {nameOf(code)} — {blocked.get(code)}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {dirty ? (
        <div className="sticky bottom-0 flex flex-col gap-2 rounded-md border border-indigo-200 bg-indigo-50 p-3 sm:flex-row sm:items-center">
          <p className="text-sm text-indigo-900">
            {changeSummary(countryDiff, stateDiff)}
          </p>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why? (kept in the history)"
            maxLength={500}
            className="bg-white sm:ml-auto sm:w-64"
            aria-label="Reason for this change"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={discard}
              disabled={mutation.isPending}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={mutation.isPending || missingStates.length > 0}
              title={
                missingStates.length > 0
                  ? `Pick at least one state in ${missingStates.map(nameOf).join(", ")}`
                  : undefined
              }
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Review &amp; save
            </Button>
          </div>
        </div>
      ) : null}

      {missingStates.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-red-700">
          <TriangleAlert className="size-3.5" />
          Pick at least one state in {missingStates.map(nameOf).join(", ")}: an
          empty list would open every state.
        </p>
      ) : null}

      <ConfirmationModal
        isOpen={confirming}
        title={`Save ${COUNTRY_LIST_LABELS[list.key]}?`}
        confirmText={mutation.isPending ? "Saving…" : "Save"}
        isDestructive={countryDiff.removed.length > 0}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (!mutation.isPending) mutation.mutate();
        }}
        message={
          <div className="space-y-3 text-sm">
            {countryDiff.removed.length > 0 ? (
              <div>
                <p className="font-medium text-red-700">
                  Removing {countryDiff.removed.length}:{" "}
                  {summarizeNames(
                    sortByName(countryDiff.removed, nameOf).map(nameOf),
                    8,
                  )}
                </p>
                <p className="text-gray-600">{removedEffect}</p>
              </div>
            ) : null}
            {countryDiff.added.length > 0 ? (
              <div>
                <p className="font-medium text-emerald-700">
                  Adding {countryDiff.added.length}:{" "}
                  {summarizeNames(
                    sortByName(countryDiff.added, nameOf).map(nameOf),
                    8,
                  )}
                </p>
                <p className="text-gray-600">{addedEffect}</p>
              </div>
            ) : null}
            {statesChanged ? (
              <div>
                <p className="font-medium text-gray-800">US states</p>
                <StateChangeLines diff={stateDiff} nameOf={nameOf} />
              </div>
            ) : null}
            {note.trim() ? (
              <p className="text-gray-500">Note: {note.trim()}</p>
            ) : null}
          </div>
        }
      />
    </div>
  );
}

/** The states one country is limited to, with a picker of all of them. */
function StatesEditor({
  countryName,
  allStates,
  states,
  savedStates,
  pendingStates,
  pendingWarning,
  onToggle,
}: {
  countryName: string;
  allStates: string[];
  states: string[];
  savedStates: string[];
  pendingStates: string[];
  pendingWarning?: string;
  onToggle: (name: string) => void;
}) {
  const selected = new Set(states);
  const saved = new Set(savedStates);
  const pending = new Set(pendingStates);
  const removed = savedStates.filter((s) => !selected.has(s));

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {countryName}: {states.length} of {allStates.length} states
          </p>
          <p className="text-xs text-gray-500">
            Rain is licensed state by state. Only these states are offered, and
            at least one must stay.
          </p>
        </div>
        <MultiSelect
          options={allStates.map((name) => ({ value: name, label: name }))}
          selected={selected}
          onToggle={onToggle}
          placeholder="Add or remove states…"
          searchPlaceholder="Search states"
          emptyText="No state matches."
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {states.map((name) => {
          const isNew = !saved.has(name);
          const warning = pendingWarning
            ? isNew
              ? `New — ${pendingWarning}`
              : pending.has(name)
                ? pendingWarning
                : undefined
            : undefined;
          return (
            <CountryChip
              key={name}
              label={name}
              tone={isNew ? "added" : "default"}
              warning={warning}
              onRemove={() => onToggle(name)}
            />
          );
        })}
        {removed.map((name) => (
          <CountryChip
            key={`removed-${name}`}
            label={name}
            tone="removed"
            onRestore={() => onToggle(name)}
          />
        ))}
      </div>
    </div>
  );
}

function StateChangeLines({
  diff,
  nameOf,
}: {
  diff: { added: StatesByCountry; removed: StatesByCountry };
  nameOf: (code: string) => string;
}) {
  const countries = new Set([
    ...Object.keys(diff.added),
    ...Object.keys(diff.removed),
  ]);
  return (
    <ul className="space-y-0.5 text-gray-600">
      {[...countries].map((country) => (
        <li key={country}>
          {nameOf(country)}:{" "}
          {diff.added[country]?.length ? (
            <span className="text-emerald-700">
              +{diff.added[country].join(", ")}
            </span>
          ) : null}
          {diff.added[country]?.length && diff.removed[country]?.length
            ? " · "
            : null}
          {diff.removed[country]?.length ? (
            <span className="text-red-700">
              −{diff.removed[country].join(", ")}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function changeSummary(
  countryDiff: { added: string[]; removed: string[] },
  stateDiff: { added: StatesByCountry; removed: StatesByCountry },
): string {
  const parts: string[] = [];
  if (countryDiff.added.length) parts.push(`${countryDiff.added.length} added`);
  if (countryDiff.removed.length) {
    parts.push(`${countryDiff.removed.length} removed`);
  }
  const statesAdded = countStates(stateDiff.added);
  const statesRemoved = countStates(stateDiff.removed);
  if (statesAdded || statesRemoved) {
    parts.push(
      `states ${[
        statesAdded && `+${statesAdded}`,
        statesRemoved && `−${statesRemoved}`,
      ]
        .filter(Boolean)
        .join(" ")}`,
    );
  }
  return `Unsaved: ${parts.join(" · ")}`;
}

/** States with no names left are sent as absent, never as an empty list. */
function dropEmpty(states: StatesByCountry): StatesByCountry {
  return Object.fromEntries(
    Object.entries(states).filter(([, names]) => names.length > 0),
  );
}
