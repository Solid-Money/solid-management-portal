"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  /** What was copied, for the toast. Defaults to a generic message. */
  label?: string;
  className?: string;
}

/**
 * Copy one value to the clipboard.
 *
 * Support spends its day moving ids between this dashboard, Rain, Wirex and
 * Intercom, so anything worth quoting is worth one click — which is why this
 * lives next to every id and address rather than only in the users table.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(label ? `${label} copied` : "Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={label ? `Copy ${label.toLowerCase()}` : "Copy"}
      aria-label={label ? `Copy ${label.toLowerCase()}` : "Copy"}
      className={cn(
        "shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 cursor-pointer",
        className
      )}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

/** A monospace value with a copy button, or an em dash when empty. */
export function CopyableValue({
  value,
  label,
  truncate = false,
  href,
}: {
  value?: string | null;
  label?: string;
  /** Show the middle-elided form used for addresses and hashes. */
  truncate?: boolean;
  href?: string;
}) {
  if (!value) return <span className="text-gray-400">—</span>;

  const display =
    truncate && value.length > 14
      ? `${value.slice(0, 6)}…${value.slice(-4)}`
      : value;

  return (
    <span className="flex items-center gap-1 font-mono text-xs">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-indigo-600 hover:text-indigo-800 hover:underline"
          title={value}
        >
          {display}
        </a>
      ) : (
        <span className="truncate" title={value}>
          {display}
        </span>
      )}
      <CopyButton value={value} label={label} />
    </span>
  );
}
