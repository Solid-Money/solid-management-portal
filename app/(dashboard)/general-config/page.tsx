"use client";

import { CreditCard, Loader2 } from "lucide-react";

import { ConfigSection } from "@/components/config/config-fields";
import { RainRtfConfigSection } from "@/components/config/rain-rtf-config";
import { useGeneralConfig } from "@/hooks/use-general-config";

/**
 * Config → General: the settings that are one of a kind.
 *
 * Grouped by "has no other home" rather than by subject. These are switches an
 * operator reaches for rarely and usually under pressure — a kill-switch
 * during an incident, an address a provider changed — and giving each one its
 * own nav entry makes it findable only by someone who already knows where it
 * is. New one-offs join this page rather than growing the Config menu.
 *
 * Every block here edits settings that also exist as deployment environment
 * variables, so each row says which layer the value in force came from.
 */
export default function GeneralConfigPage() {
  const { data, isLoading, error } = useGeneralConfig();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          General settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          One-off operational switches that do not belong to any other config
          page. A value set here overrides what the deployment&apos;s
          environment supplies; clearing it hands the setting back.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load the general settings.
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
        </div>
      ) : null}

      {data ? (
        <ConfigSection
          title="Rain Real-Time Funding"
          description="Card authorizations pulled from the cardholder's own wallet at the swipe"
          icon={<CreditCard className="h-5 w-5 text-indigo-600" />}
          defaultOpen
        >
          <RainRtfConfigSection config={data.rainRtf} />
        </ConfigSection>
      ) : null}
    </div>
  );
}
