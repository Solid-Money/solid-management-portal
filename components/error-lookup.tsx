"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Search } from "lucide-react";

import ClientErrorEntry from "@/components/client-error-entry";
import { useClientErrorLookup } from "@/hooks/use-client-errors";
import { formatErrorRef, glitchTipSearchUrl } from "@/lib/error-ref";

/**
 * Paste the Ref a user shared ("Ref 9C1B-4F2A", from a support chat or a
 * screenshot) and get the failure behind it: who, when, what they were doing,
 * what they read, and links into GlitchTip and the backend logs.
 *
 * The query lives in the URL (`?ref=`) so a lookup can be linked from a ticket.
 */
export default function ErrorLookup() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The URL is the source of truth: the nav's quick search can open another
  // Ref while this page is already mounted.
  const ref = searchParams.get("ref") ?? "";
  const query = ref.trim();
  const [input, setInput] = useState(ref);
  const [inputRef, setInputRef] = useState(ref);
  if (ref !== inputRef) {
    setInputRef(ref);
    setInput(ref);
  }

  const { data, isFetching, isError } = useClientErrorLookup(query);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    router.replace(trimmed ? `${pathname}?ref=${encodeURIComponent(trimmed)}` : pathname);
  };

  // GlitchTip resolves a full event ID directly, and a Ref through the
  // `error_ref` tag, which the app sets in its hyphenated form.
  const compact = query.replace(/^ref[\s:#]*/i, "").replace(/[\s-]/g, "");
  const glitchTipUrl = /^[0-9a-f]{32}$/i.test(compact)
    ? glitchTipSearchUrl(compact.toLowerCase())
    : /^[0-9a-f]{8}$/i.test(compact)
      ? glitchTipSearchUrl(`error_ref:${formatErrorRef(compact)}`)
      : null;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-lg bg-white p-6 shadow">
        <div className="flex max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="9C1B-4F2A"
              aria-label="Error Ref, event ID or request ID"
              className="block w-full rounded-lg border border-gray-300 bg-white py-3 pr-3 pl-10 font-mono text-lg text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Look up
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          The Ref the user saw on the failure (e.g. 9C1B-4F2A), or a full GlitchTip event ID or
          request ID.
        </p>
      </form>

      {isFetching && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {isError && !isFetching && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">The lookup failed. Check the Ref and try again.</span>
        </div>
      )}

      {data && !isFetching && data.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          <span className="text-yellow-700">
            Nothing recorded for &quot;{query}&quot;. Reports are kept for 180 days, and failures
            from app versions before error Refs aren&apos;t recorded.
            {glitchTipUrl && (
              <>
                {" "}
                <a
                  href={glitchTipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  Search GlitchTip instead
                </a>
                .
              </>
            )}
          </span>
        </div>
      )}

      {data && !isFetching && data.length > 1 && (
        <p className="text-sm text-gray-600">
          {data.length} failures share this Ref. Pick the one whose user opened the chat.
        </p>
      )}

      {data && !isFetching && (
        <div className="space-y-4">
          {data.map((match) => (
            <ClientErrorEntry key={match.id} error={match} showUser />
          ))}
        </div>
      )}
    </div>
  );
}
