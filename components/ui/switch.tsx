"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface SwitchProps
  extends Omit<React.ComponentProps<"button">, "onChange" | "value"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * An on/off switch.
 *
 * Hand-rolled rather than pulled from Radix to keep the dependency list as it
 * is. It is a native button with `role="switch"`, so focus, Space and Enter
 * come from the browser and a screen reader announces it as on or off; pass
 * `aria-label` (or label it with `aria-labelledby`) when no visible text sits
 * beside it.
 */
function Switch({
  checked,
  onCheckedChange,
  className,
  onClick,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      {...props}
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-indigo-600" : "bg-gray-300",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export { Switch };
