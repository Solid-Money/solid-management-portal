"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  /** What is stored — an alpha-2 code, or a state's name. */
  value: string;
  /** What the admin reads and searches. */
  label: string;
  /** Shown muted after the label, and searchable — the code, for countries. */
  hint?: string;
  /** Drawn before the label: a flag. */
  icon?: string;
  /** Other names to find it by: "Turkey" for Türkiye, "UK", "USA". */
  keywords?: string[];
  /**
   * A few words on why it cannot be picked ("Closed in code"). The option is
   * still listed, disabled, so nobody wonders whether the picker is missing
   * it; the full reason is spelled out beside the list.
   */
  disabledReason?: string;
}

/**
 * A searchable, scrollable multi-select: shadcn's Popover + Command combobox
 * with checkmarks. Picking toggles; the popover stays open so several can be
 * picked in one go. Search matches the label, the hint and the keywords, so
 * "TR", "turkey" and "Türkiye" all find the same country.
 */
export function MultiSelect({
  options,
  selected,
  onToggle,
  placeholder,
  searchPlaceholder,
  emptyText = "Nothing matches.",
  disabled,
}: {
  options: MultiSelectOption[];
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          disabled={disabled}
          className="w-full justify-between font-normal sm:w-80"
        >
          <span className="truncate text-gray-600">{placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-80 p-0"
        align="start"
      >
        <Command filter={rankMatch}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-80">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                const isDisabled = !!option.disabledReason && !isSelected;
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.hint ?? ""} ${option.value}`}
                    keywords={option.keywords}
                    disabled={isDisabled}
                    onSelect={() => onToggle(option.value)}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.icon ? (
                      <span aria-hidden className="text-base leading-none">
                        {option.icon}
                      </span>
                    ) : null}
                    <span className="truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="text-xs text-gray-400">
                        {option.hint}
                      </span>
                    ) : null}
                    {isDisabled ? (
                      <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                        <Lock className="size-3" />
                        {option.disabledReason}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Substring search, ranked: a word that starts with the query first, then
 * any match. cmdk's default is a fuzzy subsequence match, which for "russ"
 * also lists Suriname and Cyprus — noise when scanning 250 countries.
 */
function rankMatch(value: string, search: string, keywords?: string[]) {
  const needle = search.trim().toLowerCase();
  if (!needle) return 1;
  const terms = [value, ...(keywords ?? [])].map((term) => term.toLowerCase());
  const wordStarts = terms.some((term) =>
    term.split(/[\s,()'-]+/).some((word) => word.startsWith(needle)),
  );
  if (wordStarts) return 1;
  return terms.some((term) => term.includes(needle)) ? 0.5 : 0;
}
