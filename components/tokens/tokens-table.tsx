"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteListedToken, updateListedToken } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import {
  ContractAddress,
  TokenLogo,
  chainNameOf,
  matchesTokenSearch,
} from "@/components/tokens/token-utils";
import { ListedToken, ListedTokenChanges, TokenChain } from "@/types";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "hidden", label: "Hidden" },
  { key: "featured", label: "Featured" },
  { key: "swap-only", label: "Swap only" },
  { key: "deposit-screen", label: "On deposit screen" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const matchesStatus = (token: ListedToken, status: StatusFilter): boolean => {
  switch (status) {
    case "live":
      return token.isActive;
    case "hidden":
      return !token.isActive;
    case "featured":
      return token.isFeatured;
    case "swap-only":
      return token.swapOnly;
    case "deposit-screen":
      return token.depositOffered;
    default:
      return true;
  }
};

/** A change waiting on the admin's say-so: hiding a token, or deleting it. */
type PendingConfirmation =
  | { kind: "hide"; token: ListedToken }
  | { kind: "delete"; token: ListedToken };

/**
 * Every row of the list, filterable by chain and status and searchable by
 * ticker, name, contract or id. Showing, hiding and featuring are one click
 * here — hiding asks first, since the token leaves every user's wallet list —
 * and everything else is in the edit form.
 */
export default function TokensTable({
  tokens,
  chains,
  onEdit,
}: {
  tokens: ListedToken[];
  chains: TokenChain[];
  onEdit: (token: ListedToken) => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<number | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirming, setConfirming] = useState<PendingConfirmation | null>(
    null
  );

  const label = (token: ListedToken) =>
    `${token.symbol} on ${chainNameOf(chains, token.chainId)}`;

  const update = useMutation({
    mutationFn: async ({
      token,
      changes,
    }: {
      token: ListedToken;
      changes: ListedTokenChanges;
    }) => (await updateListedToken(token.id, changes)).data.data,
    onSuccess: (token, { changes }) => {
      const what =
        changes.isActive !== undefined
          ? changes.isActive
            ? "is live"
            : "is hidden"
          : changes.isFeatured
            ? "is featured"
            : "is no longer featured";
      toast.success(`${label(token)} ${what}`);
      void queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (token: ListedToken) => {
      await deleteListedToken(token.id);
      return token;
    },
    onSuccess: (token) => {
      toast.success(`${label(token)} deleted`);
      void queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  });

  const chainCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const token of tokens)
      counts.set(token.chainId, (counts.get(token.chainId) ?? 0) + 1);
    return counts;
  }, [tokens]);

  const visible = useMemo(
    () =>
      tokens
        .filter(
          (token) =>
            (chainFilter === "all" || token.chainId === chainFilter) &&
            matchesStatus(token, status) &&
            matchesTokenSearch(token, query)
        )
        .sort(
          (a, b) =>
            a.symbol.localeCompare(b.symbol, "en", { sensitivity: "base" }) ||
            chainNameOf(chains, a.chainId).localeCompare(
              chainNameOf(chains, b.chainId)
            )
        ),
    [tokens, chainFilter, status, query, chains]
  );

  const pendingId = update.isPending ? update.variables?.token.id : undefined;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by ticker, name, contract or id"
              className="pl-9"
              aria-label="Search tokens"
            />
          </div>
          <select
            value={chainFilter}
            onChange={(event) =>
              setChainFilter(
                event.target.value === "all"
                  ? "all"
                  : Number(event.target.value)
              )
            }
            aria-label="Chain"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
          >
            <option value="all">All chains ({tokens.length})</option>
            {chains.map((chain) => (
              <option key={chain.chainId} value={chain.chainId}>
                {chain.name} ({chainCounts.get(chain.chainId) ?? 0})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.key}
              size="xs"
              variant={status === filter.key ? "default" : "outline"}
              onClick={() => setStatus(filter.key)}
              aria-pressed={status === filter.key}
              className="cursor-pointer"
            >
              {filter.label} (
              {
                tokens.filter((token) => matchesStatus(token, filter.key))
                  .length
              }
              )
            </Button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No token matches.{" "}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setChainFilter("all");
                setStatus("all");
              }}
              className="cursor-pointer text-indigo-600 hover:underline"
            >
              Clear the filters
            </button>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-4">Token</th>
                  <th className="py-2 pr-4">Chain</th>
                  <th className="py-2 pr-4">Contract</th>
                  <th className="py-2 pr-4">In the app</th>
                  <th className="py-2 pr-4">Deposit address</th>
                  <th className="py-2 pr-4">Price id</th>
                  <th className="py-2 pr-4">Last change</th>
                  <th className="py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((token) => {
                  const chain = chains.find((c) => c.chainId === token.chainId);
                  const isPending = pendingId === token.id;
                  return (
                    <tr
                      key={token.id}
                      className={cn(!token.isActive && "bg-gray-50/70")}
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <TokenLogo
                            symbol={token.symbol}
                            logoURI={token.logoURI}
                            size={28}
                            className={cn(!token.isActive && "opacity-50")}
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              {token.symbol}
                            </div>
                            <div className="text-xs text-gray-500">
                              {token.name}
                              {token.commonId ? (
                                <span className="ml-1 font-mono text-gray-400">
                                  · {token.commonId}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {chainNameOf(chains, token.chainId)}
                      </td>
                      <td className="py-2 pr-4">
                        <ContractAddress
                          address={token.address}
                          chain={chain}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              token.isActive
                                ? setConfirming({ kind: "hide", token })
                                : update.mutate({
                                    token,
                                    changes: { isActive: true },
                                  })
                            }
                            disabled={isPending}
                            className="cursor-pointer disabled:opacity-50"
                            title={token.isActive ? "Hide it" : "Show it"}
                          >
                            <Badge
                              variant={token.isActive ? "success" : "muted"}
                            >
                              {isPending &&
                              update.variables?.changes.isActive !==
                                undefined ? (
                                <Loader2 className="animate-spin" />
                              ) : null}
                              {token.isActive ? "Live" : "Hidden"}
                            </Badge>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              update.mutate({
                                token,
                                changes: { isFeatured: !token.isFeatured },
                              })
                            }
                            disabled={isPending}
                            className="cursor-pointer rounded p-1 hover:bg-gray-100 disabled:opacity-50"
                            aria-label={
                              token.isFeatured ? "Unfeature" : "Feature"
                            }
                            aria-pressed={token.isFeatured}
                            title={
                              token.isFeatured
                                ? "Featured: pinned to the top of the swap picker"
                                : "Feature it in the swap picker"
                            }
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                token.isFeatured
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-gray-300"
                              )}
                            />
                          </button>
                          {token.depositOffered ? (
                            <Badge
                              variant="info"
                              title="The app's deposit screen offers it"
                            >
                              Deposit screen
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={token.swapOnly ? "muted" : "outline"}>
                          {token.swapOnly ? "Swap only" : "Accepted"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-600">
                        {token.tokenId ?? (
                          <span className="font-sans text-amber-700">None</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-500">
                        {token.updatedAt
                          ? formatDateTime(token.updatedAt)
                          : "—"}
                        {token.updatedBy ? (
                          <div className="text-gray-400">{token.updatedBy}</div>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onEdit(token)}
                            aria-label={`Edit ${label(token)}`}
                            className="cursor-pointer"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              setConfirming({ kind: "delete", token })
                            }
                            disabled={remove.isPending}
                            aria-label={`Delete ${label(token)}`}
                            className="cursor-pointer text-red-600 hover:text-red-700"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <ConfirmationModal
        isOpen={confirming?.kind === "hide"}
        title={confirming ? `Hide ${label(confirming.token)}?` : ""}
        message={
          <>
            {confirming?.token.depositOffered
              ? "It leaves the swap picker. Wallets keep showing it, because the deposit screen offers it."
              : "It leaves the swap picker, and balances and receives in it stop showing in users' wallets and activity."}{" "}
            The row is kept: show it again any time.
            {confirming && !confirming.token.swapOnly ? (
              <span className="mt-2 block text-sm">
                Deposit addresses keep accepting it. To stop that, edit it and
                turn off &quot;Accept on deposit addresses&quot;.
              </span>
            ) : null}
          </>
        }
        confirmText="Hide"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming)
            update.mutate({
              token: confirming.token,
              changes: { isActive: false },
            });
          setConfirming(null);
        }}
      />
      <ConfirmationModal
        isOpen={confirming?.kind === "delete"}
        title={confirming ? `Delete ${label(confirming.token)}?` : ""}
        message={
          <>
            The row is deleted outright: who added it and its settings go with
            it. To take it out of the app and keep the row, hide it instead.
            {confirming && !confirming.token.swapOnly ? (
              <span className="mt-2 block text-sm font-medium text-red-700">
                Deposit addresses accept it today. Deleting it can stop them
                accepting it.
              </span>
            ) : null}
          </>
        }
        confirmText="Delete"
        isDestructive
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) remove.mutate(confirming.token);
          setConfirming(null);
        }}
      />
    </Card>
  );
}
