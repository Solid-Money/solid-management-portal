"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";

import { addMissingDepositTokens } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContractAddress,
  TokenLogo,
  chainNameOf,
} from "@/components/tokens/token-utils";
import { MissingDepositToken, TokenChain, TokenDraft } from "@/types";

/**
 * The tokens the app's deposit screen tells people to send that the list has
 * no row for. They still show in the wallet once they land, but not in the
 * swap picker, and are priced by symbol only.
 *
 * Grouped by asset, because that is how they are thought of — "add PAXG" — and
 * each can be added as it is (one click for all of them) or reviewed in the
 * add form first. A token sent straight to the Safe is added swap-only, so
 * listing it never opens deposits for it on a minted deposit address.
 */
export default function MissingDepositTokens({
  tokens,
  chains,
  onReview,
}: {
  tokens: MissingDepositToken[];
  chains: TokenChain[];
  onReview: (draft: TokenDraft) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const groups = useMemo(() => {
    const bySymbol = new Map<string, MissingDepositToken[]>();
    for (const token of tokens) {
      bySymbol.set(token.symbol, [
        ...(bySymbol.get(token.symbol) ?? []),
        token,
      ]);
    }
    return [...bySymbol.entries()];
  }, [tokens]);

  const add = useMutation({
    mutationFn: async (keys: string[]) =>
      (await addMissingDepositTokens(keys)).data.data,
    onSuccess: ({ added, skipped }) => {
      toast.success(
        `Added ${added.length} token${added.length === 1 ? "" : "s"}` +
          (skipped.length ? `; ${skipped.length} were already listed` : "")
      );
      void queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  });
  const addingKeys = add.isPending ? (add.variables ?? []) : [];

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex cursor-pointer items-center gap-2 text-left"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <span>
            <CardTitle>
              {tokens.length} deposit token{tokens.length === 1 ? "" : "s"} not
              in the list
            </CardTitle>
            <span className="mt-1 block text-xs font-normal text-gray-600">
              The deposit screen offers{" "}
              {groups.map(([symbol]) => symbol).join(", ")} on chains the list
              has no row for. Until they are added they stay out of the swap
              picker and are priced by symbol alone.
            </span>
          </span>
        </button>
        <Button
          size="sm"
          onClick={() => add.mutate(tokens.map((token) => token.key))}
          disabled={add.isPending}
          className="cursor-pointer"
        >
          {add.isPending && addingKeys.length === tokens.length ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PackagePlus className="h-4 w-4" />
          )}
          Add all {tokens.length}
        </Button>
      </CardHeader>

      {isOpen ? (
        <CardContent className="space-y-3">
          {groups.map(([symbol, entries]) => (
            <div
              key={symbol}
              className="rounded-md border border-gray-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                <span className="flex items-center gap-2">
                  <TokenLogo
                    symbol={symbol}
                    logoURI={entries[0].logoURI}
                    size={24}
                  />
                  <span className="font-medium text-gray-900">{symbol}</span>
                  <span className="text-sm text-gray-500">
                    {entries[0].name}
                  </span>
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => add.mutate(entries.map((entry) => entry.key))}
                  disabled={add.isPending}
                  className="cursor-pointer"
                >
                  Add on {entries.length} chain{entries.length === 1 ? "" : "s"}
                </Button>
              </div>
              <ul className="divide-y divide-gray-100 text-sm">
                {entries.map((entry) => {
                  const chain = chains.find((c) => c.chainId === entry.chainId);
                  return (
                    <li
                      key={entry.key}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
                    >
                      <span className="w-28 text-gray-700">
                        {chainNameOf(chains, entry.chainId)}
                      </span>
                      <ContractAddress address={entry.address} chain={chain} />
                      <Badge variant={entry.swapOnly ? "muted" : "info"}>
                        {entry.swapOnly ? "Swap only" : "Deposit address"}
                      </Badge>
                      <span className="ml-auto">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => onReview(entry)}
                          disabled={add.isPending}
                          className="cursor-pointer"
                        >
                          Review and add
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
