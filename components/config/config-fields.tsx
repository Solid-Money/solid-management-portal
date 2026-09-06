"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The form controls the admin config pages are built from.
 *
 * Shared rather than duplicated per page: rewards config and fees config edit
 * the same document through the same endpoints, and a second copy of a
 * percentage input is how one page ends up validating a rate and the other not.
 */

export function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="ml-1 inline-block h-4 w-4 cursor-help text-gray-400 hover:text-gray-600" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export interface ConfigSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ConfigSection({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
}: ConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between bg-gray-50 px-6 py-4 transition-colors hover:bg-gray-100"
      >
        <div className="flex items-center space-x-3">
          {icon}
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="text-sm font-normal text-gray-500">{description}</p>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="space-y-4 px-6 py-4">{children}</div>}
    </div>
  );
}

export interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  suffix?: string;
  disabled?: boolean;
  min?: number;
  step?: string;
  tooltip?: string;
}

export function InputField({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  disabled = false,
  min,
  step,
  tooltip,
}: InputFieldProps) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-sm font-medium text-gray-700">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <div className="flex items-center">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          min={min}
          step={step}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
        />
        {suffix && (
          <span className="ml-2 text-sm whitespace-nowrap text-gray-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export interface ToggleFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tooltip?: string;
}

export function ToggleField({
  label,
  value,
  onChange,
  disabled = false,
  tooltip,
}: ToggleFieldProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${
          value ? "bg-indigo-600" : "bg-gray-300"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function TierGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>
  );
}

export function TierCard({
  tier,
  children,
}: {
  tier: string;
  children: React.ReactNode;
}) {
  const tierColors: Record<string, string> = {
    "Tier 1": "border-gray-300 bg-gray-50",
    "Tier 2": "border-blue-300 bg-blue-50",
    "Tier 3": "border-purple-300 bg-purple-50",
  };

  return (
    <div
      className={`space-y-3 rounded-lg border-2 p-4 ${tierColors[tier] || "border-gray-300"}`}
    >
      <h4 className="font-semibold text-gray-800">{tier}</h4>
      {children}
    </div>
  );
}
