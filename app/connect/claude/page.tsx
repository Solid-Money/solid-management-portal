"use client";

import { Suspense, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { describeApiError } from "@/lib/api";
import {
  ConnectRequest,
  decideConnectRequest,
  describeConnectRequest,
} from "@/lib/support-connect-api";

/** The OAuth parameters admins-service forwards; anything else is ignored. */
const PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const;

const ABILITIES = [
  "Read the queues, conversations and internal notes",
  "Look up customers and help articles",
  "Reply to customers and message them first",
  "Write internal notes and @mention agents",
  "Assign, snooze, escalate, resolve and reopen cases",
];

/**
 * Where an agent allows their Claude to work the support inbox as them (the
 * Solid Support connector). Reached from Claude through admins-service's
 * OAuth authorize step; the portal sign-in brings the agent back here.
 */
export default function ConnectClaudePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Suspense fallback={<Spinner />}>
        <ConnectClaude />
      </Suspense>
    </div>
  );
}

function ConnectClaude() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const request = useMemo<ConnectRequest>(() => {
    const picked: ConnectRequest = {};
    for (const key of PARAMS) {
      const value = searchParams.get(key);
      if (value !== null) picked[key] = value;
    }
    return picked;
  }, [searchParams]);

  // A consent button inside someone else's frame could be clicked by trick.
  const framed = useSyncExternalStore(
    noSubscription,
    () => window.top !== window.self,
    () => false,
  );

  const description = useQuery({
    // Per agent: the cache outlives sign-out, and the answer names the account.
    queryKey: ["support-connect", user?.uid ?? null, request],
    queryFn: () => describeConnectRequest(request),
    enabled: !!user && !!request.client_id,
    retry: false,
    staleTime: Infinity,
  });

  const decision = useMutation({
    mutationFn: (allow: boolean) => decideConnectRequest(request, allow),
    onSuccess: ({ redirectTo }) => {
      window.location.assign(redirectTo);
    },
  });

  // Signed out: AuthProvider sends the agent to sign in and back here.
  if (loading || !user) return <Spinner />;

  if (!request.client_id) {
    return (
      <Panel title="Nothing to connect">
        <p className="text-sm text-gray-600">
          Open this page from Claude: Settings, Connectors, Solid Support,
          Connect.
        </p>
      </Panel>
    );
  }

  if (framed) {
    return (
      <Panel title="Open this page in its own tab">
        <p className="text-sm text-gray-600">
          For your safety, connecting Claude only works when this page is not
          inside another site.
        </p>
      </Panel>
    );
  }

  if (description.isPending) return <Spinner />;

  if (description.isError) {
    return (
      <Panel title="Claude couldn't connect">
        <p className="text-sm text-gray-600">
          {describeApiError(description.error)}
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Start again from Claude. If it keeps happening, remove the Solid
          Support connector and add it again.
        </p>
      </Panel>
    );
  }

  const { clientName, redirectHost, email } = description.data;
  const done = decision.isSuccess;

  return (
    <Panel title="Connect Claude to Solid Support">
      <p className="text-sm text-gray-700">
        <span className="font-medium">{clientName}</span> wants to work the
        support inbox as <span className="font-medium">{email}</span>. It will
        be able to:
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
        {ABILITIES.map((ability) => (
          <li key={ability} className="flex gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600" />
            {ability}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-gray-500">
        Everything it does is recorded under your name. The connection lasts
        30 days. Removing the connector in Claude, or signing out of your
        Google account everywhere, ends it sooner. After you answer, you go
        back to {redirectHost}.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={decision.isPending || done}
          onClick={() => decision.mutate(false)}
        >
          Cancel
        </Button>
        <Button
          disabled={decision.isPending || done}
          onClick={() => decision.mutate(true)}
        >
          {decision.isPending || done ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Allow"
          )}
        </Button>
      </div>
      {done && (
        <p className="mt-3 text-right text-xs text-gray-500">
          Returning to Claude…
        </p>
      )}
    </Panel>
  );
}

/** Whether the page is framed never changes while it is open. */
function noSubscription() {
  return () => {};
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />;
}
