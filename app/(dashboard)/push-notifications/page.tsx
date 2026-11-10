"use client";

import { Suspense, useState } from "react";
import { BellRing, Eye, Loader2 } from "lucide-react";

import { CampaignHistory } from "@/components/push-campaigns/campaign-history";
import { PushCampaignComposer } from "@/components/push-campaigns/push-campaign-composer";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePushCampaignDestinations } from "@/hooks/use-push-campaigns";
import { useUrlTab } from "@/hooks/use-url-tab";

const TABS = ["compose", "history"] as const;

/**
 * Growth → Push notifications: send one push, or an A/B test of up to three,
 * to an uploaded list of users, each opening a chosen screen of the app —
 * including a given page of the What's New popup.
 *
 * Every targeted user is assigned to a variant or the control group before
 * anything is sent, and that assignment is recorded per user (in Mongo and as
 * an Amplitude event), so a variant's effect on deposits is read across
 * everyone assigned to it, not only the people who opened the push.
 */
export default function PushNotificationsPage() {
  return (
    <Suspense fallback={null}>
      <PushNotificationsScreen />
    </Suspense>
  );
}

function PushNotificationsScreen() {
  const [tab, setTab] = useUrlTab(TABS, "compose");
  const [composerKey, setComposerKey] = useState(0);
  const { data: config, isLoading, error } = usePushCampaignDestinations();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <BellRing className="h-5 w-5 text-gray-400" />
            Push notifications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Send a push to a list of users, or test up to three versions
            against each other with a held-back control group. Each push opens
            the screen you choose on iOS and Android. Check the audience and
            send yourself a test before sending.
          </p>
        </div>
        {config && !config.canSend ? (
          <Badge variant="warning">
            <Eye className="h-3 w-3" />
            Preview only
          </Badge>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : error || !config ? (
        <p className="text-sm text-red-600">
          Failed to load push notification settings.
        </p>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          {/* Kept mounted while History is open, so a draft survives a look at
              past campaigns and a send in flight still reports back. Remounted
              after a send, so the next campaign starts from a clean form. */}
          <TabsContent
            value="compose"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <PushCampaignComposer
              key={composerKey}
              config={config}
              onSent={() => {
                setComposerKey((key) => key + 1);
                setTab("history");
              }}
            />
          </TabsContent>
          <TabsContent value="history">
            <CampaignHistory destinations={config.destinations} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
