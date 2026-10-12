import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type {
  SupportAgentCase,
  SupportCaseStatus,
  SupportQueueView,
} from "@/types/support";

export const VIEW_LABELS: Record<SupportQueueView, string> = {
  needs_human: "Needs a human",
  mine: "Mine",
  ai_handling: "AI handling",
  waiting_customer: "Waiting on customer",
  escalated: "Escalated",
  snoozed: "Snoozed",
  resolved: "Resolved",
};

const STATUS: Record<
  SupportCaseStatus,
  { label: string; variant: "danger" | "info" | "warning" | "success" | "muted" | "secondary" }
> = {
  needs_human: { label: "Needs a human", variant: "danger" },
  assigned: { label: "Assigned", variant: "info" },
  ai_handling: { label: "AI handling", variant: "secondary" },
  waiting_customer: { label: "Waiting on customer", variant: "muted" },
  escalated: { label: "Escalated", variant: "warning" },
  snoozed: { label: "Snoozed", variant: "muted" },
  resolved: { label: "Resolved", variant: "success" },
};

export function StatusBadge({ status }: { status: SupportCaseStatus }) {
  const entry = STATUS[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function intentLabel(intent: string | null): string {
  if (!intent) return "No intent";
  return intent.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export const COMPLAINT_LABELS: Record<string, string> = {
  complaint: "Complaint",
  dispute: "Dispute",
  unauthorized_transaction: "Unauthorized transaction",
};

export const ESCALATION_TARGETS: Array<{ value: string; label: string }> = [
  { value: "engineering", label: "Engineering" },
  { value: "card_issuer", label: "Card issuer" },
  { value: "kyc_provider", label: "KYC provider" },
  { value: "on_ramp", label: "On-ramp" },
  { value: "other", label: "Other" },
];

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "es" → "Spanish", via the browser's own names; falls back to the tag. */
export function languageName(tag: string | null | undefined): string | null {
  if (!tag) return null;
  try {
    const names = new Intl.DisplayNames(["en"], { type: "language" });
    return names.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/** Seconds as "45s", "12m", "3h 5m", "2d 4h". */
export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function percent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "—" : `${Math.round(rate * 1000) / 10}%`;
}

/** A person-readable name for an agent email: the part before the @. */
export function agentShortName(email: string | null | undefined): string {
  return email ? email.split("@")[0] : "";
}

export function caseHeadline(supportCase: SupportAgentCase): string {
  return `Case #${supportCase.number}${supportCase.title ? ` · ${supportCase.title}` : ""}`;
}
