"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Smartphone,
  Workflow,
} from "lucide-react";

import { NewNudgeDialog } from "@/components/nudges/new-nudge-dialog";
import { NudgeBoard } from "@/components/nudges/nudge-board";
import { NudgeEditorSheet } from "@/components/nudges/nudge-editor-sheet";
import { NudgeHistory } from "@/components/nudges/nudge-history";
import { NudgeRules } from "@/components/nudges/nudge-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNudgeBoard } from "@/hooks/use-nudges";
import { useUrlTab } from "@/hooks/use-url-tab";

const TABS = ["push", "email", "rules", "history"] as const;

/**
 * Growth → Automated nudges: every automated push and email the app sends,
 * drawn as the user journey they make up, and edited here instead of in code.
 *
 * Push and Email show the same graph, each with its own channel's content;
 * Rules holds what every marketing nudge obeys (switch, consent, frequency
 * cap, quiet hours); History lists every change, by whom and why. Copy,
 * Brevo template, timing, on/off, links and images are changed per nudge from
 * its editor, reviewed field by field before saving.
 */
export default function NudgesPage() {
  return (
    <Suspense fallback={null}>
      <NudgesScreen />
    </Suspense>
  );
}

/** The open nudge, kept in the URL (`?nudge=key`) so a link opens it. */
function useOpenNudge(): [string | null, (key: string | null) => void] {
  const searchParams = useSearchParams();
  const open = searchParams.get("nudge");
  const setOpen = useCallback((key: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (key) params.set("nudge", key);
    else params.delete("nudge");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`
    );
  }, []);
  return [open, setOpen];
}

function NudgesScreen() {
  const [tab, setTab] = useUrlTab(TABS, "push");
  const [openKey, setOpenKey] = useOpenNudge();
  const [creating, setCreating] = useState(false);
  const { data: board, isLoading, error, refetch, isFetching } = useNudgeBoard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Workflow className="h-5 w-5 text-gray-400" />
            Automated nudges
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Every automated push and email, as the journey they make up. Open a
            nudge to change its copy, Brevo template, timing, the screen it
            opens or its image, turn it on or off, and send yourself a test.
            Changes reach the next sends within a minute and are kept in the
            history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {board && !board.canEdit ? (
            <Badge variant="warning">
              <Eye className="h-3 w-3" />
              View only
            </Badge>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? "animate-spin" : undefined} />
            Refresh
          </Button>
          {board?.canEdit && board.migrated ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              New nudge
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : !board ? (
        <p className="text-sm text-red-600">
          Failed to load the nudges.{" "}
          <button
            type="button"
            onClick={() => void refetch()}
            className="cursor-pointer underline"
          >
            Try again
          </button>
        </p>
      ) : (
        <>
          {/* A failed refresh keeps what was loaded (and any unsaved edit in
              the editor or the rules) on screen. */}
          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                Couldn&apos;t refresh the nudges; showing what was loaded before.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={isFetching ? "animate-spin" : undefined} />
                Try again
              </Button>
            </div>
          ) : null}
          {!board.migrated ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              <span>
                The nudges still live in code: what you see is read-only. Move
                them to the database (a dry run shows every change first) to
                edit them here.
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/scripts#nudge-migrations">Open the migration</Link>
              </Button>
            </div>
          ) : null}
          {!board.canEdit ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You can see the nudges and their history but not change them.
              Changes are limited to the admins in{" "}
              <code>NUDGE_ADMIN_EMAILS</code>.
            </div>
          ) : null}
          {!board.settings.marketingEnabled ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Marketing nudges are switched off (Rules). Only transactional
              nudges are sending.
            </div>
          ) : null}

          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="push">
                <Smartphone />
                Push
              </TabsTrigger>
              <TabsTrigger value="email">
                <Mail />
                Email
              </TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="push">
              <NudgeBoard board={board} channel="push" onSelect={setOpenKey} />
            </TabsContent>
            <TabsContent value="email">
              <NudgeBoard board={board} channel="email" onSelect={setOpenKey} />
            </TabsContent>
            <TabsContent value="rules">
              <NudgeRules board={board} />
            </TabsContent>
            <TabsContent value="history">
              <NudgeHistory onOpen={setOpenKey} />
            </TabsContent>
          </Tabs>

          <NudgeEditorSheet
            nudgeKey={openKey}
            board={board}
            onClose={() => setOpenKey(null)}
          />
          <NewNudgeDialog
            open={creating}
            onOpenChange={setCreating}
            board={board}
            onCreated={(key) => {
              setCreating(false);
              setOpenKey(key);
            }}
          />
        </>
      )}
    </div>
  );
}
