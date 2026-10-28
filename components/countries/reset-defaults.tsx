"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { resetCountryAccessToDefaults } from "@/lib/api";
import {
  COUNTRY_LIST_LABELS,
  countStates,
  diffCodes,
  diffStates,
  sortByName,
  summarizeNames,
} from "@/lib/country-access";
import type {
  CountryAccessList,
  CountryAccessOverview,
} from "@/types/country-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ConfirmationModal from "@/components/ui/confirmation-modal";

/**
 * Rewrite the card and VA lists from the code constants — how a fresh
 * environment is seeded. It overwrites every edit made on this page, so the
 * confirmation spells out, per list, exactly what it would reopen or close.
 */
export function ResetDefaults({
  overview,
  nameOf,
}: {
  overview: CountryAccessOverview;
  nameOf: (code: string) => string;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const lists = Object.values(overview.lists).filter(
    (
      list,
    ): list is CountryAccessList & {
      defaults: NonNullable<CountryAccessList["defaults"]>;
    } => list.defaults !== null,
  );
  const changes = lists
    .map((list) => ({
      list,
      countries: diffCodes(list.countries, list.defaults.countries),
      states: diffStates(list.states, list.defaults.states),
    }))
    .filter(
      (change) =>
        change.countries.added.length > 0 ||
        change.countries.removed.length > 0 ||
        countStates(change.states.added) + countStates(change.states.removed) >
          0,
    );

  const mutation = useMutation({
    mutationFn: async () => (await resetCountryAccessToDefaults()).data.data,
    onSuccess: () => {
      toast.success("Country lists reset to the code defaults");
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["country-access"] });
    },
    onError: () => setConfirming(false),
  });

  return (
    <Card className="border-red-100">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            Reset to code defaults
          </p>
          <p className="text-xs text-gray-500">
            Rewrites the Wirex card, Rain card and Rain virtual account lists
            from the lists in code — how a new environment is seeded. It undoes
            every edit made here.{" "}
            {changes.length === 0
              ? "The lists match the defaults right now."
              : `${changes.length} list${changes.length === 1 ? "" : "s"} would change.`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => setConfirming(true)}
          disabled={mutation.isPending || changes.length === 0}
        >
          {mutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RotateCcw />
          )}
          Reset…
        </Button>
      </CardContent>

      <ConfirmationModal
        isOpen={confirming}
        title="Reset every list to the code defaults?"
        confirmText={mutation.isPending ? "Resetting…" : "Reset"}
        isDestructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (!mutation.isPending) mutation.mutate();
        }}
        message={
          <div className="space-y-3 text-sm">
            {changes.map(({ list, countries, states }) => (
              <div key={list.key}>
                <p className="font-medium text-gray-900">
                  {COUNTRY_LIST_LABELS[list.key]}
                </p>
                {countries.added.length > 0 ? (
                  <p className="text-emerald-700">
                    Reopens{" "}
                    {summarizeNames(
                      sortByName(countries.added, nameOf).map(nameOf),
                      6,
                    )}
                  </p>
                ) : null}
                {countries.removed.length > 0 ? (
                  <p className="text-red-700">
                    Closes{" "}
                    {summarizeNames(
                      sortByName(countries.removed, nameOf).map(nameOf),
                      6,
                    )}
                  </p>
                ) : null}
                {countStates(states.added) + countStates(states.removed) > 0 ? (
                  <p className="text-gray-600">
                    US states: +{countStates(states.added)} / −
                    {countStates(states.removed)}
                  </p>
                ) : null}
              </div>
            ))}
            <p className="text-gray-500">
              The TransFi list is not touched. Whatever this reopens shows as
              not live until the provider side is confirmed again.
            </p>
          </div>
        }
      />
    </Card>
  );
}
