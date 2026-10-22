"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

import { getTokenCatalogue } from "@/lib/api";
import { TokenCatalogue } from "@/types";
import { Button } from "@/components/ui/button";
import MissingDepositTokens from "@/components/tokens/missing-deposit-tokens";
import TokenEditorDialog, {
  TokenEditorState,
} from "@/components/tokens/token-editor-dialog";
import TokensTable from "@/components/tokens/tokens-table";

/** What each column does, said once at the top rather than in every tooltip. */
const SETTINGS_GUIDE = [
  {
    term: "In the app",
    detail:
      "Live tokens show in the swap picker and the wallet, and their receives show in activity. Hiding keeps the row; the star pins a token to the top of the swap picker.",
  },
  {
    term: "Deposit address",
    detail:
      "Accepted: a transfer of it to a cardholder's minted deposit address opens a deposit. Swap only: listed for swapping, ignored there. Hiding a token does not change this.",
  },
  {
    term: "Price id",
    detail:
      "The CoinGecko coin id the app prices it by when nothing else has a price.",
  },
  {
    term: "Cross-chain id",
    detail:
      "Rows sharing one (usdc on every chain) are one line in the wallet, their balances added up.",
  },
];

/**
 * Config → Tokens: the `swaptokens` list, which used to be edited straight in
 * Mongo.
 *
 * The list does more than its name says, and the page is laid out around
 * that: it is the swap picker, it decides which balances and receives the
 * wallet and activity show, and it is the whitelist a minted deposit address
 * checks. So adding starts from a chain and a contract and reads the rest
 * from the chain; the deposit tokens it is missing are listed up top with one
 * click to add; and hiding or deleting says what it will change before it does.
 */
export default function TokensPage() {
  const [editor, setEditor] = useState<TokenEditorState | null>(null);
  const { data, isLoading, error } = useQuery<TokenCatalogue>({
    queryKey: ["tokens"],
    queryFn: async () => (await getTokenCatalogue()).data.data,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold text-gray-900">Tokens</h1>
          <p className="mt-1 text-sm text-gray-500">
            The tokens the app knows: what the swap picker offers, which
            balances and receives the wallet and activity show, and what a
            minted deposit address accepts. Open apps pick a change up within
            about five minutes.
          </p>
        </div>
        <Button
          onClick={() => setEditor({ mode: "add" })}
          disabled={!data}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add token
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm md:grid-cols-2">
        {SETTINGS_GUIDE.map(({ term, detail }) => (
          <div key={term}>
            <dt className="font-medium text-gray-900">{term}</dt>
            <dd className="mt-0.5 text-xs text-gray-500">{detail}</dd>
          </div>
        ))}
      </dl>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load the tokens.
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
        </div>
      ) : null}

      {data ? (
        <>
          {data.missingDepositTokens.length > 0 ? (
            <MissingDepositTokens
              tokens={data.missingDepositTokens}
              chains={data.chains}
              onReview={(draft) => setEditor({ mode: "add", draft })}
            />
          ) : null}
          <TokensTable
            tokens={data.tokens}
            chains={data.chains}
            onEdit={(token) => setEditor({ mode: "edit", token })}
          />
          <TokenEditorDialog
            state={editor}
            chains={data.chains}
            tokens={data.tokens}
            onClose={() => setEditor(null)}
            onEditExisting={(token) => setEditor({ mode: "edit", token })}
          />
        </>
      ) : null}
    </div>
  );
}
