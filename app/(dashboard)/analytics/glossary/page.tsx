"use client";

import { glossaryEntries } from "@/lib/glossary";

/**
 * The glossary, in full.
 *
 * The same entries the hover definitions read, on one page so a definition can
 * be linked to and argued with. Where a term has a caveat, it is shown as
 * prominently as the definition — the caveat is usually the part that changes
 * how a number should be read.
 */
export default function GlossaryPage() {
  const entries = glossaryEntries();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Glossary</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Every metric in Analytics is defined here, and every label in the UI
          links to its entry. If a number looks wrong, check its definition
          first — most disagreements between two dashboards have turned out to
          be two definitions rather than two datasets.
        </p>
      </div>

      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {entries.map((entry) => (
          <div key={entry.key} className="p-6">
            <h3 className="text-sm font-semibold text-gray-900">
              {entry.term}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
              {entry.definition}
            </p>
            {entry.source ? (
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-500">
                {entry.source}
              </p>
            ) : null}
            {entry.caveat ? (
              <p className="mt-2 max-w-3xl border-l-2 border-amber-300 pl-3 text-xs leading-relaxed text-amber-800">
                {entry.caveat}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
