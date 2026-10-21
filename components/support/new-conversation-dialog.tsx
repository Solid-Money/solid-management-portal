"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, agentShortName } from "@/components/support/support-format";
import { useDebounce } from "@/hooks/use-debounce";
import { useSupportUserCases } from "@/hooks/use-support";
import api from "@/lib/api";
import { newAgentMessageId, startSupportConversation } from "@/lib/support-api";
import type { UsersResponse } from "@/types";

/** Who the conversation is with. */
export interface NewConversationUser {
  id: string;
  /** Username, else email: how the agent recognises them. */
  label: string;
  email?: string | null;
}

const RESULTS = 8;

/**
 * Write to a customer first: about an issue or an update, without waiting
 * for them to contact us. The message goes out like a reply (in the app,
 * with a push, in their language when we know it). If they have no open
 * case, it opens one assigned to the agent, so their answer comes back to
 * that agent and not to Solid AI.
 *
 * From the inbox the agent searches for the customer; from the user page
 * they're already picked.
 */
export default function NewConversationDialog({
  open,
  onOpenChange,
  user,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselected (the user page); otherwise the agent searches for one. */
  user?: NewConversationUser;
  /**
   * Open a conversation: the one the message went to (`sent`), or the one
   * the customer already has, when the agent chose to open it instead.
   */
  onStarted: (conversationId: string, sent: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted per opening, so each one starts empty. */}
        {open && (
          <NewConversationForm
            fixedUser={user}
            onCancel={() => onOpenChange(false)}
            onDone={(conversationId, sent) => {
              onOpenChange(false);
              onStarted(conversationId, sent);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewConversationForm({
  fixedUser,
  onCancel,
  onDone,
}: {
  fixedUser?: NewConversationUser;
  onCancel: () => void;
  onDone: (conversationId: string, sent: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<NewConversationUser | null>(fixedUser ?? null);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim(), 250);
  const [body, setBody] = useState("");
  // One per message: a retry after a timeout can't send it twice.
  const [clientMessageId, setClientMessageId] = useState(newAgentMessageId);
  const [translationFailed, setTranslationFailed] = useState(false);

  const results = useQuery<UsersResponse>({
    queryKey: ["support-new-conversation-users", debounced],
    queryFn: async () =>
      (
        await api.get("/admin/v1/users", {
          params: { search: debounced, sort: "createdAt", order: "desc", page: 1, limit: RESULTS },
          quietErrors: true,
        })
      ).data,
    enabled: !picked && debounced.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const pick = (next: NewConversationUser | null) => {
    setPicked(next);
    setClientMessageId(newAgentMessageId());
    setTranslationFailed(false);
  };

  const send = useMutation({
    mutationFn: (sendUntranslated: boolean) =>
      startSupportConversation(picked!.id, {
        clientMessageId,
        body: body.trim(),
        ...(sendUntranslated ? { sendUntranslated: true } : {}),
      }),
    onSuccess: (result) => {
      toast.success(`Message sent to ${picked!.label}`);
      void queryClient.invalidateQueries({ queryKey: ["support"] });
      onDone(result.conversationId, true);
    },
    onError: (error) => {
      // Translation to their language failed: offer to send the English.
      if (isAxiosError(error) && error.response?.status === 409) setTranslationFailed(true);
    },
  });

  const canSend = !!picked && body.trim().length > 0 && !send.isPending;
  const submit = () => {
    if (canSend) send.mutate(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New conversation</DialogTitle>
        <DialogDescription>
          Write to a customer first. They get it in the app with a push notification, in their language when we
          know it. If they have no open case, this opens one assigned to you, so their reply comes back to you.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-conversation-user">Customer</Label>
          {picked ? (
            <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{picked.label}</p>
                <p className="truncate text-xs text-gray-500">
                  {picked.email && picked.email !== picked.label ? `${picked.email} · ` : ""}
                  {picked.id}
                </p>
              </div>
              {!fixedUser && (
                <Button variant="ghost" size="xs" className="ml-auto" onClick={() => pick(null)}>
                  Change
                </Button>
              )}
            </div>
          ) : (
            <UserSearch
              value={search}
              onChange={setSearch}
              searching={debounced.length >= 2}
              loading={results.isFetching}
              failed={results.isError}
              users={results.data?.data ?? []}
              onPick={pick}
            />
          )}
          {picked && (
            <ExistingConversation userId={picked.id} onOpen={(conversationId) => onDone(conversationId, false)} />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-conversation-body">Message (in English)</Label>
          <Textarea
            id="new-conversation-body"
            rows={5}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setTranslationFailed(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Hi! We noticed your deposit is taking longer than usual…"
            className="min-h-28"
          />
        </div>

        {translationFailed && (
          <div className="flex items-center gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>We couldn&apos;t translate it to their language.</span>
            <Button
              size="xs"
              variant="outline"
              className="ml-auto shrink-0"
              disabled={send.isPending}
              onClick={() => send.mutate(true)}
            >
              Send in English
            </Button>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={send.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSend} title="⌘/Ctrl + Enter">
          {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Send
        </Button>
      </DialogFooter>
    </>
  );
}

function UserSearch({
  value,
  onChange,
  searching,
  loading,
  failed,
  users,
  onPick,
}: {
  value: string;
  onChange: (value: string) => void;
  searching: boolean;
  loading: boolean;
  failed: boolean;
  users: UsersResponse["data"];
  onPick: (user: NewConversationUser) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          id="new-conversation-user"
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Username, email, user id or wallet"
          className="pl-8"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>
      {searching && (
        <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
          {failed ? (
            <p className="px-3 py-2 text-sm text-gray-500">The search failed. Try again.</p>
          ) : users.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">{loading ? "Searching…" : "No users found."}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {users.map((user) => {
                const label = user.username || user.email || user._id;
                return (
                  <li key={user._id}>
                    <button
                      type="button"
                      disabled={user.isDeleted}
                      onClick={() => onPick({ id: user._id, label, email: user.email })}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900">{label}</span>
                        <span className="block truncate text-xs text-gray-500">
                          {user.email && user.email !== label ? `${user.email} · ` : ""}
                          {user._id}
                        </span>
                      </span>
                      {user.isDeleted && (
                        <Badge variant="muted" className="ml-auto shrink-0">
                          Deleted
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Whether this message starts a case or joins the one they have. */
function ExistingConversation({ userId, onOpen }: { userId: string; onOpen: (conversationId: string) => void }) {
  const { data, isLoading } = useSupportUserCases(userId);
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  if (!data?.conversationId) {
    return <p className="text-xs text-gray-500">No conversation yet. This starts one, assigned to you.</p>;
  }
  const conversationId = data.conversationId;
  const openCase = data.cases.find((c) => c.status !== "resolved");
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
      {openCase ? (
        <>
          <span>Open case #{openCase.number}</span>
          <StatusBadge status={openCase.status} />
          <span>
            {openCase.assigneeEmail
              ? `Assigned to ${agentShortName(openCase.assigneeEmail)}. Your message is added to it.`
              : "Your message is added to it, and it's assigned to you."}
          </span>
        </>
      ) : (
        <span>
          {data.cases.length} past {data.cases.length === 1 ? "case" : "cases"}. This opens a new one, assigned to you.
        </span>
      )}
      <Link
        href={`/support?c=${conversationId}`}
        onClick={(event) => {
          event.preventDefault();
          onOpen(conversationId);
        }}
        className="text-indigo-600 hover:underline"
      >
        Open the conversation instead
      </Link>
    </div>
  );
}
