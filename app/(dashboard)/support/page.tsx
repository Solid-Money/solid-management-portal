"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Inbox, Loader2 } from "lucide-react";
import SupportMeGate from "@/components/support/support-me-gate";
import ContextPanel from "@/components/support/context-panel";
import QueueList from "@/components/support/queue-list";
import ThreadView from "@/components/support/thread-view";
import { useSupportCounts } from "@/hooks/use-support";
import { SUPPORT_QUEUE_VIEWS, type SupportMe, type SupportQueueView } from "@/types/support";

function isView(value: string | null): value is SupportQueueView {
  return !!value && (SUPPORT_QUEUE_VIEWS as readonly string[]).includes(value);
}

/**
 * The support inbox: queue, thread and the customer beside it. The view,
 * the search and the open conversation live in the URL (`?view=&q=&c=`), so
 * a link from Slack or the user page opens the right thread.
 */
function InboxScreen({ me }: { me: SupportMe }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view: SupportQueueView = isView(params.get("view")) ? (params.get("view") as SupportQueueView) : "needs_human";
  const query = params.get("q") ?? "";
  const open = params.get("c");
  const { data: counts } = useSupportCounts();

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const agents = me.agents.length ? me.agents : [me.email];

  return (
    <div className="-mx-2 grid h-[calc(100vh-7.5rem)] grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_22rem] 2xl:grid-cols-[21rem_minmax(0,1fr)_24rem]">
      <QueueList
        view={view}
        query={query}
        selected={open}
        counts={counts ?? me.counts}
        onView={(next) => update({ view: next })}
        onQuery={(next) => update({ q: next || null })}
        onSelect={(conversationId) => update({ c: conversationId })}
      />
      {open ? (
        <ThreadView key={open} conversationId={open} me={me.email} agents={agents} />
      ) : (
        <section className="hidden flex-col items-center justify-center rounded-lg bg-white text-sm text-gray-500 shadow-sm lg:flex">
          <Inbox className="mb-2 h-8 w-8 text-gray-300" />
          Pick a conversation from the queue.
        </section>
      )}
      {open && (
        <div className="hidden min-h-0 xl:block">
          <ContextPanel conversationId={open} />
        </div>
      )}
    </div>
  );
}

export default function SupportInboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <SupportMeGate>{(me) => <InboxScreen me={me} />}</SupportMeGate>
    </Suspense>
  );
}
