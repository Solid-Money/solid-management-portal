"use client";

import { Info, TriangleAlert, Undo2, X } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * One country (or US state) on a list: its name, with the stored code beside
 * it, and the markers that matter before announcing a market —
 *
 *  - amber ⚠ `warning`: on our list but not live for users yet, because a
 *    developer still has to update Didit or Sumsub;
 *  - indigo ⓘ `info`: on the list, but routing sends new applicants
 *    elsewhere (closed in code, or another issuer wins it).
 */
export function CountryChip({
  label,
  code,
  flag,
  tone = "default",
  warning,
  info,
  onRemove,
  onRestore,
}: {
  label: string;
  code?: string;
  flag?: string;
  /** `added`/`removed`: an unsaved change in the editor. */
  tone?: "default" | "added" | "removed";
  warning?: string;
  info?: string;
  onRemove?: () => void;
  onRestore?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border py-1 pr-1 pl-2 text-sm",
        tone === "added" && "border-emerald-300 bg-emerald-50",
        tone === "removed" && "border-red-200 bg-red-50 text-gray-500",
        tone === "default" && "border-gray-200 bg-white",
      )}
    >
      {flag ? (
        <span aria-hidden className="text-base leading-none">
          {flag}
        </span>
      ) : null}
      <span
        className={cn(
          "text-gray-900",
          tone === "removed" && "text-gray-500 line-through",
        )}
      >
        {label}
      </span>
      {code ? <span className="text-xs text-gray-400">{code}</span> : null}
      {warning ? (
        <Marker text={warning}>
          <TriangleAlert
            className="size-3.5 text-amber-500"
            aria-label={warning}
          />
        </Marker>
      ) : null}
      {info ? (
        <Marker text={info}>
          <Info className="size-3.5 text-indigo-500" aria-label={info} />
        </Marker>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label={`Remove ${label}`}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      {onRestore ? (
        <button
          type="button"
          onClick={onRestore}
          className="cursor-pointer rounded p-0.5 text-gray-500 hover:bg-red-100 hover:text-gray-800"
          aria-label={`Keep ${label}`}
          title="Undo"
        >
          <Undo2 className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}

function Marker({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  );
}
