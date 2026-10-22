"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CreditCard,
  Fingerprint,
  Landmark,
  Loader2,
  TriangleAlert,
} from "lucide-react";

import { getCountryAccess } from "@/lib/api";
import { countStates, makeCountryNamer } from "@/lib/country-access";
import type {
  CountryAccessList,
  CountryAccessOverview,
} from "@/types/country-access";
import { CountryListEditor } from "@/components/countries/country-list-editor";
import { FeatureSection } from "@/components/countries/feature-section";
import { ListHistory } from "@/components/countries/list-history";
import { ProviderSyncPanel } from "@/components/countries/provider-sync-panel";
import { ReadOnlyCountryList } from "@/components/countries/read-only-country-list";
import { ResetDefaults } from "@/components/countries/reset-defaults";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Config → Countries: which countries each provider takes new sign-ups from,
 * one section per provider and one folded row per feature.
 *
 * The lists here are the live gate — the same documents card and account
 * routing read — so opening or closing a market is a save, not a deploy.
 * What a save cannot reach is the provider's own side: Rain applicants pick
 * their country in a Didit questionnaire, and Wirex applicants verify against
 * a Sumsub level. A country added here is marked ⚠ until someone confirms
 * that side caught up, so nobody announces a market that is not open yet.
 */
export default function CountriesPage() {
  const { data, isLoading, error } = useQuery<CountryAccessOverview>({
    queryKey: ["country-access"],
    queryFn: async () => (await getCountryAccess()).data.data,
  });

  const nameOf = useMemo(
    () => makeCountryNamer(data?.catalog ?? []),
    [data?.catalog],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Countries</h1>
        <p className="mt-1 text-sm text-gray-500">
          Where each provider takes new sign-ups. Saving a list changes who can
          start sign-up straight away; people who already have the product are
          not affected. Countries marked{" "}
          <TriangleAlert className="inline size-3.5 text-amber-500" /> are on
          our list but not live for users yet — a developer still has to update
          Didit or Sumsub.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load the country lists.
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
        </div>
      ) : null}

      {data ? (
        <>
          <EnvironmentStrip overview={data} nameOf={nameOf} />

          <ProviderSection
            title="Wirex"
            description="Card and EUR bank account. Applicants verify with Sumsub. Wirex wins every country both card issuers list."
          >
            <FeatureSection
              icon={CreditCard}
              title="Card"
              subtitle="Countries the Wirex card takes new applicants from"
              badges={<ListBadges list={data.lists.wirex_card} />}
            >
              {!data.environment.wirexCardEnabled ? (
                <Notice>
                  The Wirex card is switched off in this environment
                  (WIREX_CARD_ENABLED), so this list is not read: every
                  applicant goes to Rain.
                </Notice>
              ) : null}
              <CountryListEditor
                key={editorKey(data.lists.wirex_card)}
                list={data.lists.wirex_card}
                catalog={data.catalog}
                stateCatalog={data.stateCatalog}
                nameOf={nameOf}
                pendingWarning="Not live yet: a developer must confirm the Sumsub level accepts this country and that Wirex onboards it."
                addedEffect="Our gate sends new card applicants from these countries to Wirex at once. They stay marked ⚠ until a developer confirms the Sumsub level accepts them."
                removedEffect="New Wirex card sign-ups from these countries stop at once: applicants go to Rain where Rain serves the country, and otherwise see that cards aren't available in their region. Existing cardholders keep their cards."
              />
              <ProviderSyncPanel list={data.lists.wirex_card} nameOf={nameOf} />
              <ListHistory
                history={data.lists.wirex_card.history}
                nameOf={nameOf}
              />
            </FeatureSection>

            <FeatureSection
              icon={Landmark}
              title="EUR bank account (SEPA IBAN)"
              subtitle="Residence countries Wirex issues a personal IBAN to"
              badges={
                <>
                  <Badge variant="muted">
                    {data.reference.wirexSepa.length} countries
                  </Badge>
                  <Badge
                    variant={
                      !data.environment.wirexVirtualAccountEnabled
                        ? "danger"
                        : data.environment.wirexTeamOnly
                          ? "warning"
                          : "success"
                    }
                  >
                    {!data.environment.wirexVirtualAccountEnabled
                      ? "Off"
                      : data.environment.wirexTeamOnly
                        ? "Internal team only"
                        : "Live"}
                  </Badge>
                </>
              }
            >
              <p className="text-sm text-gray-600">
                Routes users to Wirex before they have a Wirex account to ask.
                Wirex&apos;s own per-user capability decides in the end.
                Everyone else gets Rain&apos;s USD account.
              </p>
              <ReadOnlyCountryList
                codes={data.reference.wirexSepa}
                nameOf={nameOf}
                source="wirex-bank-countries.ts"
              />
            </FeatureSection>
          </ProviderSection>

          <ProviderSection
            title="Rain"
            description="Card and USD virtual account. Applicants verify with Didit and pick their country and US state in a Didit questionnaire."
          >
            <FeatureSection
              icon={CreditCard}
              title="Card"
              subtitle="Countries and US states the Rain card takes new applicants from"
              badges={<ListBadges list={data.lists.rain_card} />}
            >
              <CountryListEditor
                key={editorKey(data.lists.rain_card)}
                list={data.lists.rain_card}
                catalog={data.catalog}
                stateCatalog={data.stateCatalog}
                nameOf={nameOf}
                pendingWarning="Not live yet: applicants can't pick it in the Didit form until a developer links a new questionnaire to the card workflow."
                addedEffect="Our gate lets these through at once, but applicants can't pick them in the Didit form until a new questionnaire is generated and linked to the card workflow. They stay marked ⚠ until then."
                removedEffect="New Rain card sign-ups from these countries stop at once. Existing cardholders keep their cards."
              />
              <ProviderSyncPanel list={data.lists.rain_card} nameOf={nameOf} />
              <ListHistory
                history={data.lists.rain_card.history}
                nameOf={nameOf}
              />
            </FeatureSection>

            <FeatureSection
              icon={Landmark}
              title="USD virtual account"
              subtitle="Countries and US states where users can open a Rain USD account"
              badges={<ListBadges list={data.lists.rain_virtual_account} />}
            >
              <CountryListEditor
                key={editorKey(data.lists.rain_virtual_account)}
                list={data.lists.rain_virtual_account}
                catalog={data.catalog}
                stateCatalog={data.stateCatalog}
                nameOf={nameOf}
                pendingWarning="Not live yet: applicants can't pick it in the Didit form until a developer links a new questionnaire to the virtual-account workflow."
                addedEffect="Our gate lets these through at once, but applicants can't pick them in the Didit form until a new questionnaire is generated and linked to the virtual-account workflow. They stay marked ⚠ until then."
                removedEffect="New Rain USD accounts can't be opened from these countries any more. Existing accounts are not affected."
              />
              <ProviderSyncPanel
                list={data.lists.rain_virtual_account}
                nameOf={nameOf}
              />
              <ListHistory
                history={data.lists.rain_virtual_account.history}
                nameOf={nameOf}
              />
            </FeatureSection>
          </ProviderSection>

          <ProviderSection
            title="TransFi"
            description="Local-currency cash deposits and cash-outs."
          >
            <FeatureSection
              icon={Banknote}
              title="Cash deposits & cash-outs: hidden in"
              subtitle="Countries where the app does not offer TransFi"
              badges={
                <Badge variant="muted">
                  {data.lists.transfi_prohibited.countries.length} hidden
                </Badge>
              }
            >
              <p className="text-sm text-gray-600">
                The app hides TransFi here, on top of the list built into the
                app (EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES), which always
                applies — so this can close a country without a release but
                cannot reopen one the build closed. TransFi&apos;s own list:{" "}
                <a
                  href="https://docs.transfi.com/docs/prohibited-countries"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  docs.transfi.com
                </a>
                .
              </p>
              <CountryListEditor
                key={editorKey(data.lists.transfi_prohibited)}
                list={data.lists.transfi_prohibited}
                catalog={data.catalog}
                stateCatalog={data.stateCatalog}
                nameOf={nameOf}
                addedEffect="The app stops offering TransFi cash deposits and cash-outs in these countries within about five minutes."
                removedEffect="The app offers TransFi there again within about five minutes, unless the list built into the app also hides it."
              />
            </FeatureSection>

            <FeatureSection
              icon={Fingerprint}
              title="Onramp identity check"
              subtitle="Buyers in these countries verify with Sumsub; everywhere else with Didit"
              badges={
                <Badge variant="muted">
                  {data.reference.sumsubOnramp.length} countries
                </Badge>
              }
            >
              <ReadOnlyCountryList
                codes={data.reference.sumsubOnramp}
                nameOf={nameOf}
                source="provider-routing.ts, SUMSUB_ONRAMP_COUNTRY_CODES"
              />
            </FeatureSection>
          </ProviderSection>

          <ResetDefaults overview={data} nameOf={nameOf} />
        </>
      ) : null}
    </div>
  );
}

/**
 * Remount the editor when the stored countries or states change (a save, or
 * someone else's), so its draft starts from what is stored. Keyed on content
 * rather than `updatedAt`: generating a questionnaire also bumps that, and
 * must not throw away an edit in progress.
 */
function editorKey(list: CountryAccessList): string {
  return `${list.key}:${[...list.countries].sort().join(",")}:${JSON.stringify(list.states)}`;
}

function ProviderSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/** The summary line of a folded list: size, and anything waiting. */
function ListBadges({ list }: { list: CountryAccessList }) {
  const pending =
    list.pendingCountries.length + countStates(list.pendingStates);
  return (
    <>
      {!list.isEnabled ? <Badge variant="danger">Disabled</Badge> : null}
      <Badge variant="muted">{list.countries.length} countries</Badge>
      {pending > 0 ? (
        <Badge variant="warning">
          <TriangleAlert />
          {pending} not live yet
        </Badge>
      ) : list.providerSync?.outOfSync ? (
        <Badge variant="warning">Didit form out of date</Badge>
      ) : null}
    </>
  );
}

function EnvironmentStrip({
  overview,
  nameOf,
}: {
  overview: CountryAccessOverview;
  nameOf: (code: string) => string;
}) {
  const { environment, reference } = overview;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      <span>This environment:</span>
      <Badge variant={environment.wirexCardEnabled ? "success" : "danger"}>
        Wirex card {environment.wirexCardEnabled ? "on" : "off"}
      </Badge>
      {reference.wirexClosed.length > 0 ? (
        <Badge variant="muted">
          Closed to Wirex in code:{" "}
          {reference.wirexClosed.map(nameOf).join(", ")}
        </Badge>
      ) : null}
      {environment.qaOnlyCountries.length > 0 ? (
        <Badge variant="info">
          QA-only: {environment.qaOnlyCountries.map(nameOf).join(", ")}
        </Badge>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
