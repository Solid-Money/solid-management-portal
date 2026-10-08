"use client";

import { useEffect, useEffectEvent, useId, useState } from "react";
import { Search, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import type { ErrorsViewState } from "@/hooks/use-errors-view-state";
import {
  ERROR_FLOW_LABELS,
  ERROR_FLOWS,
  ERROR_SOURCE_LABELS,
  ERROR_SOURCES,
  GROUP_SORT_LABELS,
  GROUP_STATUS_LABELS,
  GROUP_STATUSES,
  PLATFORM_LABELS,
  PLATFORMS,
  RANGE_PRESETS,
  SEVERITIES,
  SEVERITY_LABELS,
  WHO_ACTS,
  WHO_ACTS_LABELS,
} from "@/lib/errors";

const SELECT_CLASS =
  "block h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

interface Option {
  value: string;
  label: string;
}

const options = (values: readonly string[], labels: Record<string, string>) =>
  values.map((value) => ({ value, label: labels[value] ?? value }));

const SOURCE_OPTIONS = options(ERROR_SOURCES, ERROR_SOURCE_LABELS);
const FLOW_OPTIONS = options(ERROR_FLOWS, ERROR_FLOW_LABELS);
const WHO_ACTS_OPTIONS = options(WHO_ACTS, WHO_ACTS_LABELS);
const SEVERITY_OPTIONS = options(SEVERITIES, SEVERITY_LABELS);
const PLATFORM_OPTIONS = options(PLATFORMS, PLATFORM_LABELS);
const STATUS_OPTIONS = options(GROUP_STATUSES, GROUP_STATUS_LABELS);
const SORT_OPTIONS = Object.entries(GROUP_SORT_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const RANGE_OPTIONS = RANGE_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
}));

function SelectField({
  label,
  value,
  options,
  anyLabel,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Option[];
  /** The "no filter" option; omitted when one of the options must be chosen. */
  anyLabel?: string;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className={SELECT_CLASS}
      >
        {anyLabel !== undefined && <option value="">{anyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A text filter that commits to the URL once typing settles, so the query
 * (and the link) follow the search without a request per keystroke.
 */
function SearchField({
  label,
  placeholder,
  value,
  icon: Icon,
  onCommit,
}: {
  label: string;
  placeholder: string;
  /** The committed value, from the URL. */
  value: string;
  icon: typeof Search;
  onCommit: (value: string | undefined) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const settled = useDebounce(draft, 400);

  const commit = useEffectEvent((next: string) => {
    const trimmed = next.trim();
    if (trimmed !== value) onCommit(trimmed || undefined);
  });

  useEffect(() => {
    commit(settled);
  }, [settled]);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          id={id}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          className="w-52 bg-white pl-8"
        />
      </div>
    </div>
  );
}

interface ErrorFiltersBarProps {
  state: ErrorsViewState;
  update: (next: Partial<ErrorsViewState>) => void;
  /** Status and sort, which only mean something for the groups table. */
  showGroupControls?: boolean;
}

/**
 * The filters every tab shares. They live in the URL (see
 * `useErrorsViewState`), so switching tabs keeps them and a link carries them.
 */
export function ErrorFiltersBar({
  state,
  update,
  showGroupControls = false,
}: ErrorFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SearchField
        label="User"
        placeholder="Username, email or id"
        icon={User}
        value={state.user ?? ""}
        onCommit={(user) => update({ user })}
      />
      <SearchField
        label="Search"
        placeholder="Title, message or code"
        icon={Search}
        value={state.q ?? ""}
        onCommit={(q) => update({ q })}
      />
      <SelectField
        label="Time"
        value={state.range}
        options={RANGE_OPTIONS}
        onChange={(range) =>
          update({ range: RANGE_PRESETS.find((p) => p.id === range)?.id })
        }
      />
      <SelectField
        label="Source"
        value={state.source}
        options={SOURCE_OPTIONS}
        anyLabel="All sources"
        onChange={(source) =>
          update({ source: ERROR_SOURCES.find((s) => s === source) })
        }
      />
      <SelectField
        label="Flow"
        value={state.flow}
        options={FLOW_OPTIONS}
        anyLabel="All flows"
        onChange={(flow) => update({ flow: ERROR_FLOWS.find((f) => f === flow) })}
      />
      <SelectField
        label="Who acts"
        value={state.whoActs}
        options={WHO_ACTS_OPTIONS}
        anyLabel="Anyone"
        onChange={(whoActs) =>
          update({ whoActs: WHO_ACTS.find((w) => w === whoActs) })
        }
      />
      <SelectField
        label="Severity"
        value={state.severity}
        options={SEVERITY_OPTIONS}
        anyLabel="Any severity"
        onChange={(severity) =>
          update({ severity: SEVERITIES.find((s) => s === severity) })
        }
      />
      <SelectField
        label="Platform"
        value={state.platform}
        options={PLATFORM_OPTIONS}
        anyLabel="All platforms"
        onChange={(platform) => update({ platform })}
      />
      {showGroupControls && (
        <>
          <SelectField
            label="Status"
            value={state.status}
            options={STATUS_OPTIONS}
            anyLabel="All statuses"
            onChange={(status) =>
              update({ status: GROUP_STATUSES.find((s) => s === status) })
            }
          />
          <SelectField
            label="Sort by"
            value={state.sort}
            options={SORT_OPTIONS}
            onChange={(sort) =>
              update({
                sort: sort === "count" || sort === "users" ? sort : "lastSeen",
              })
            }
          />
        </>
      )}
    </div>
  );
}
