"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

import { countryFlag, matchesCountry, sortByName } from "@/lib/country-access";
import { CountryChip } from "@/components/countries/country-chip";
import { Input } from "@/components/ui/input";

/**
 * A list that lives in code, shown so the page answers "where is this
 * offered?" for every feature — with where it is kept, so nobody hunts for an
 * edit button that cannot exist.
 */
export function ReadOnlyCountryList({
  codes,
  nameOf,
  source,
}: {
  codes: string[];
  nameOf: (code: string) => string;
  /** Where the list is kept, e.g. `wirex-bank-countries.ts`. */
  source: string;
}) {
  const [filter, setFilter] = useState("");
  const shown = sortByName(codes, nameOf).filter((code) =>
    matchesCountry(code, nameOf(code), filter),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <Lock className="size-3.5" />
          {codes.length} countries · kept in code ({source}); changing it is a
          deploy.
        </p>
        {codes.length > 16 ? (
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter these ${codes.length} countries`}
            className="sm:w-64"
            aria-label="Filter the countries on this list"
          />
        ) : null}
      </div>
      <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
        {shown.map((code) => (
          <CountryChip
            key={code}
            label={nameOf(code)}
            code={code}
            flag={countryFlag(code)}
          />
        ))}
      </div>
    </div>
  );
}
