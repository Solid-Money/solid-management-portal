import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BadgeDollarSign,
  BarChart3,
  Bell,
  BookOpen,
  CircleAlert,
  Clock,
  CreditCard,
  FileClock,
  FolderTree,
  Gift,
  History,
  Inbox,
  KeyRound,
  Landmark,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Terminal,
  TrendingUp,
  User as UserIcon,
  UserCheck,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { NAV_GROUPS } from "@/lib/navigation";
import { ANALYTICS_TABS, analyticsHref } from "@/lib/analytics-navigation";
import { FEE_PRODUCTS, feeSectionId } from "@/components/config/fee-product-rates";
import { ONBOARDING_FEES } from "@/components/config/onboarding-fee-charge";
import { VIEW_LABELS } from "@/components/support/support-format";
import { SUPPORT_QUEUE_VIEWS } from "@/types/support";

/**
 * Everything the admin search can take you to that is not a user: every page,
 * the sections inside them, and the buttons that start something.
 *
 * Sections link with a URL hash naming the element's `id`
 * (`/rewards-config#referral-system`); `SectionScroller` lands on it, waiting
 * for it to render. Tabs are reached through `?tab=`, which the tabbed pages
 * read with `useUrlTab`. A `#` here must match an `id` on the page — when a
 * section is renamed or moved, move its entry with it.
 *
 * Wallets are not listed here: they come from the wallets status call, so the
 * search lists whatever the registry holds today.
 */

export type SearchEntryKind = "page" | "section" | "action";

export interface SearchEntry {
  /** Unique across the catalog; also the command item's value. */
  id: string;
  kind: SearchEntryKind;
  label: string;
  /** Where it lives, shown before the label: "Config › Rewards". */
  context?: string;
  /** One line under the label. */
  description?: string;
  href: string;
  icon: LucideIcon;
  /** Other words someone might type for it. Matched, never shown. */
  keywords?: string[];
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const NAV_PAGES: SearchEntry[] = NAV_GROUPS.flatMap((group) =>
  group.href
    ? [
        {
          id: `page:${group.href}`,
          kind: "page" as const,
          label: group.label,
          href: group.href,
          icon: group.icon,
          description: "Every user, searchable and sortable",
        },
      ]
    : (group.items ?? []).map((item) => ({
        id: `page:${item.href}`,
        kind: "page" as const,
        label: item.label,
        context: group.label,
        description: item.description,
        href: item.href,
        icon: item.icon,
        keywords: [group.label],
      }))
);

/** Analytics tabs the top bar does not list, and every live sub-tab. */
const ANALYTICS_ENTRIES: SearchEntry[] = ANALYTICS_TABS.flatMap((tab) => {
  const page: SearchEntry = {
    id: `page:/analytics/${tab.id}`,
    kind: "page",
    label: tab.label,
    context: "Analytics",
    description: tab.question,
    href: analyticsHref(tab),
    icon: BarChart3,
    keywords: ["analytics", "dashboard", "metrics"],
  };
  const listed = NAV_PAGES.some((entry) => entry.id === page.id);
  const subTabs = tab.subTabs
    .filter((subTab) => !subTab.pending)
    .map(
      (subTab): SearchEntry => ({
        id: `section:/analytics/${tab.id}?tab=${subTab.id}`,
        kind: "section",
        label: subTab.label,
        context: `Analytics › ${tab.label}`,
        description: subTab.question,
        href: `/analytics/${tab.id}?tab=${subTab.id}`,
        icon: BarChart3,
        keywords: ["analytics", tab.label],
      })
    );
  return listed ? subTabs : [page, ...subTabs];
});

// ---------------------------------------------------------------------------
// Sections and actions on the global pages
// ---------------------------------------------------------------------------

const section = (
  href: string,
  label: string,
  context: string,
  icon: LucideIcon,
  extra: Pick<SearchEntry, "description" | "keywords"> = {}
): SearchEntry => ({
  id: `section:${href}`,
  kind: "section",
  label,
  context,
  href,
  icon,
  ...extra,
});

const action = (
  href: string,
  label: string,
  context: string,
  icon: LucideIcon,
  extra: Pick<SearchEntry, "description" | "keywords"> = {}
): SearchEntry => ({
  id: `action:${href}`,
  kind: "action",
  label,
  context,
  href,
  icon,
  ...extra,
});

const SUPPORT_ENTRIES: SearchEntry[] = [
  ...SUPPORT_QUEUE_VIEWS.map((view) =>
    section(
      `/support?view=${view}`,
      VIEW_LABELS[view],
      "Support › Inbox",
      Inbox,
      { keywords: ["queue", "cases", "conversations", "tickets"] }
    )
  ),
  section("/support/settings#solid-ai", "Solid AI mode", "Support › Settings", Sparkles, {
    description: "Off, shadow or on — the kill switch",
    keywords: ["ai", "kill switch", "shadow", "autopilot", "bot"],
  }),
  section("/support/settings#ai-knowledge", "What Solid AI knows", "Support › Settings", BookOpen, {
    keywords: ["ai", "knowledge", "instructions", "prompt", "allowlist", "intents"],
  }),
  section("/support/settings#support-team", "Team and on-call", "Support › Settings", Users, {
    keywords: ["on call", "agents", "roster", "urgent"],
  }),
  section("/support/settings#known-incidents", "Known incidents", "Support › Settings", AlertTriangle, {
    keywords: ["outage", "incident", "status", "banner"],
  }),
  section("/support/settings#saved-replies", "Saved replies", "Support › Settings", MessagesSquare, {
    keywords: ["macros", "canned responses", "templates", "snippets"],
  }),
  section("/support/settings#settings-history", "Settings history", "Support › Settings", History, {
    keywords: ["versions", "audit", "changes"],
  }),
  section("/support/reports#cases-per-day", "Cases per day", "Support › Reports", BarChart3, {
    keywords: ["volume", "tickets"],
  }),
  section("/support/reports#response-times", "Response times and ratings", "Support › Reports", Clock, {
    keywords: ["sla", "first response", "csat", "resolve time"],
  }),
  section("/support/reports#content-gaps", "Content gaps", "Support › Reports", BookOpen, {
    description: "Handoffs the help center had no answer for",
    keywords: ["articles to write", "missing", "help center"],
  }),
  action("/support/articles#new-article", "New help article", "Support › Help Center", Plus, {
    keywords: ["write", "create", "article", "faq"],
  }),
  action("/support/articles#import-intercom", "Import from Intercom", "Support › Help Center", RefreshCw, {
    keywords: ["intercom", "sync", "copy"],
  }),
  action("/support/articles#help-collections", "Help collections", "Support › Help Center", FolderTree, {
    keywords: ["categories", "folders", "order"],
  }),
];

const TREASURY_ENTRIES: SearchEntry[] = [
  section("/wallets?tab=funding", "Funding ledger", "Treasury › Wallets", Receipt, {
    description: "What we have actually spent topping wallets up",
    keywords: ["top up", "spend", "refills"],
  }),
  section("/wallets?tab=history", "Treasury history", "Treasury › Wallets", History, {
    description: "Threshold changes and confirmed top-ups",
    keywords: ["audit", "log", "who changed"],
  }),
  section("/wallets#wallet-alert-settings", "Wallet alert thresholds", "Treasury › Wallets", Bell, {
    description: "Days of cover that count as urgent or low, and Slack pacing",
    keywords: ["critical", "low", "slack", "alerts", "runway"],
  }),
  action("/wallets#refill-wallets", "Refill wallets", "Treasury › Wallets", Wallet, {
    description: "The queue of tokens that need funding today",
    keywords: ["top up", "fund", "gas", "empty", "admin wallet"],
  }),
];

const CONFIG_ENTRIES: SearchEntry[] = [
  ...(
    [
      ["tier-thresholds", "Tier thresholds", ["levels", "points needed"]],
      ["points-earning", "Points earning", ["points", "earn rate"]],
      ["referral-system", "Referral system", ["referral rewards", "invite"]],
      ["referral-cashback", "Referral cashback program", ["referrer cashback"]],
      ["card-cashback", "Cashback on card transactions", ["cashback rate", "card rewards"]],
      ["yield-boost", "Yield boost", ["apy boost", "bonus yield"]],
      ["card-welcome-bonus", "Card welcome bonus", ["signup bonus", "first card"]],
      ["subscription-discounts", "Subscription discounts", ["netflix", "spotify", "mcc", "category"]],
      ["fuse-staking", "FUSE staking for tier unlock", ["stake", "fuse", "unlock"]],
      ["tier-membership", "Tier membership", ["v3", "tier lock", "prime", "ultra"]],
    ] as const
  ).map(([id, label, keywords]) =>
    section(`/rewards-config#${id}`, label, "Config › Rewards", Gift, {
      keywords: ["rewards", ...keywords],
    })
  ),
  ...FEE_PRODUCTS.map((product) =>
    section(`/fees-config#${feeSectionId(product.key)}`, `${product.label} fees`, "Config › Fees", product.icon, {
      description: product.summary,
      keywords: ["fee", "rate", "tier"],
    })
  ),
  ...ONBOARDING_FEES.map((fee) =>
    section(`/fees-config#${feeSectionId(fee.key)}`, fee.label, "Config › Fees", BadgeDollarSign, {
      description: fee.summary,
      keywords: ["fee", "onboarding", "one-time"],
    })
  ),
  section("/fees-config#minimum-charge", "Minimum fee charge", "Config › Fees", Scale, {
    keywords: ["floor", "waived", "minimum"],
  }),
  section("/deposit-fees#deposit-fee-status", "Deposit fee status", "Config › Deposit Fees", ArrowRightLeft, {
    keywords: ["bridge fee", "enable", "launch"],
  }),
  section("/deposit-fees#deposit-fee-rates", "Deposit fee rates", "Config › Deposit Fees", ArrowRightLeft, {
    keywords: ["bridge fee", "route", "source chain", "percent"],
  }),
  section("/deposit-fees#deposit-fee-history", "Deposit fee history", "Config › Deposit Fees", History, {
    keywords: ["changes", "audit"],
  }),
  ...(
    [
      ["programme-switches", "Anti-abuse switches", ["toggle", "enable"]],
      ["excluded-merchants", "Excluded merchants", ["blocklist", "merchant", "no cashback"]],
      ["excluded-mccs", "Excluded merchant categories", ["mcc", "category", "gambling"]],
      ["referral-qualification-rules", "Referral qualification rules", ["referral", "minimum spend"]],
      ["test-a-merchant", "Test a merchant", ["check merchant", "would it earn"]],
    ] as const
  ).map(([id, label, keywords]) =>
    section(`/anti-abuse#${id}`, label, "Config › Anti-abuse", ShieldAlert, {
      keywords: ["anti-abuse", "fraud", ...keywords],
    })
  ),
  section("/general-config#rain-rtf", "Rain Real-Time Funding", "Config › General", Zap, {
    keywords: ["rtf", "rain", "authorization", "card funding"],
  }),
  section("/bulk#stuck-cashback", "Stuck cashback", "Config › Bulk", BadgeDollarSign, {
    description: "Re-send cashback that gave up after five payout attempts",
    keywords: ["permanently failed", "failed cashback", "re-send", "retry", "payout", "bulk"],
  }),
  section("/bulk#tier-trials", "Tier trials", "Config › Bulk", Sparkles, {
    keywords: ["prime", "ultra", "batch", "trial", "gift", "bulk"],
  }),
  action("/bulk#gift-trials", "Gift tier trials", "Config › Bulk", Sparkles, {
    description: "Prime or Ultra for a list of usernames at once",
    keywords: ["prime", "ultra", "batch", "trial", "gift"],
  }),
];

const GROWTH_AND_CONTENT_ENTRIES: SearchEntry[] = [
  action("/campaigns#new-campaign", "New cashback campaign", "Growth › Campaigns", Megaphone, {
    keywords: ["create", "merchant", "promotion", "location"],
  }),
  action("/cohorts#recalculate-cohorts", "Recalculate cohorts", "Growth › Cohorts", RefreshCw, {
    keywords: ["refresh", "segments", "snapshot"],
  }),
  section("/referral-review?tab=blocked", "Blocked referrers", "Growth › Referral Review", ShieldCheck, {
    keywords: ["block", "banned", "fraud", "referral"],
  }),
  section("/referral-review?tab=recheck", "Re-check unpaid referral rewards", "Growth › Referral Review", RefreshCw, {
    keywords: ["recheck", "payout", "unpaid", "referral"],
  }),
  action("/whats-new#new-popup", "New What's New popup", "Content › What's New", Plus, {
    keywords: ["release notes", "carousel", "announcement", "create"],
  }),
  action("/promotions-banner#new-banner", "New promotions banner", "Content › Promotions Banner", Plus, {
    keywords: ["banner", "home screen", "promo", "create"],
  }),
  section("/scripts#cohort-snapshot-script", "Cohort snapshot script", "Content › Scripts", Terminal, {
    keywords: ["run", "trigger", "backfill", "maintenance"],
  }),
  section("/artifacts#add-artifact", "Add a Claude artifact", "Content › Claude Artifacts", Plus, {
    keywords: ["embed", "dashboard", "report"],
  }),
];

/** The catalog, minus wallets and the open user's sections. */
export const SEARCH_ENTRIES: SearchEntry[] = [
  ...NAV_PAGES,
  ...ANALYTICS_ENTRIES,
  ...SUPPORT_ENTRIES,
  ...TREASURY_ENTRIES,
  ...CONFIG_ENTRIES,
  ...GROWTH_AND_CONTENT_ENTRIES,
];

/** Shown when the search opens empty: where most visits start. */
export const SUGGESTED_PAGE_IDS = [
  "page:/users",
  "page:/support",
  "page:/error-lookup",
  "page:/card-transactions",
  "page:/wallets",
];

// ---------------------------------------------------------------------------
// One user's profile
// ---------------------------------------------------------------------------

/** The user profile's tabs, as `?tab=` spells them. */
export const USER_TABS = [
  "overview",
  "activity",
  "deposits",
  "card",
  "rewards",
  "support",
  "errors",
] as const;
export type UserTab = (typeof USER_TABS)[number];

interface UserTarget {
  key: string;
  kind: "section" | "action";
  label: string;
  tab: UserTab;
  /** The `SectionAnchor` id on the profile page. */
  anchor: string;
  icon: LucideIcon;
  keywords?: string[];
}

const USER_TARGETS: UserTarget[] = [
  { key: "profile", kind: "section", label: "Profile", tab: "overview", anchor: "user-profile", icon: UserIcon, keywords: ["email", "wallet", "safe", "country", "referral code", "2fa"] },
  { key: "balances", kind: "section", label: "Balances", tab: "overview", anchor: "user-balances", icon: Wallet, keywords: ["tokens", "holdings", "usd"] },
  { key: "savings", kind: "section", label: "Savings", tab: "overview", anchor: "user-savings", icon: PiggyBank, keywords: ["vault", "sousd", "yield", "apy"] },
  { key: "activity", kind: "section", label: "Activity", tab: "activity", anchor: "user-activity", icon: Activity, keywords: ["transactions", "history", "transfers", "withdrawals"] },
  { key: "deposits", kind: "section", label: "Deposits", tab: "deposits", anchor: "user-deposits", icon: ArrowRightLeft, keywords: ["stuck deposit", "bridge", "workflow"] },
  { key: "kyc", kind: "section", label: "KYC", tab: "card", anchor: "user-kyc", icon: UserCheck, keywords: ["verification", "didit", "sumsub", "identity", "declined"] },
  { key: "virtual-account", kind: "section", label: "USD virtual account", tab: "card", anchor: "user-virtual-account", icon: Landmark, keywords: ["bank", "iban", "ach", "virtual account"] },
  { key: "card", kind: "section", label: "Card", tab: "card", anchor: "user-card", icon: CreditCard, keywords: ["card id", "wirex", "rain", "status", "holds", "settlements"] },
  { key: "cashback", kind: "section", label: "Cashback", tab: "card", anchor: "user-cashback", icon: Gift, keywords: ["cashback history", "failed cashback"] },
  { key: "rtf", kind: "section", label: "Real-Time Funding", tab: "card", anchor: "user-rtf", icon: Zap, keywords: ["rtf", "allowance", "declines"] },
  { key: "card-spending", kind: "section", label: "Card spending", tab: "card", anchor: "user-card-spending", icon: Receipt, keywords: ["card transactions", "purchases", "merchants"] },
  { key: "rewards", kind: "section", label: "Rewards and points", tab: "rewards", anchor: "user-rewards", icon: Gift, keywords: ["points", "rewards"] },
  { key: "tier", kind: "section", label: "Tier membership", tab: "rewards", anchor: "user-tier", icon: TrendingUp, keywords: ["tier", "prime", "ultra", "level"] },
  { key: "tier-trial", kind: "section", label: "Tier trial", tab: "rewards", anchor: "user-tier-trial", icon: Sparkles, keywords: ["trial", "gift"] },
  { key: "cashback-rate", kind: "section", label: "Cashback rate", tab: "rewards", anchor: "user-cashback-rate", icon: Gift, keywords: ["override", "percentage"] },
  { key: "referrals", kind: "section", label: "Referrals", tab: "rewards", anchor: "user-referrals", icon: Users, keywords: ["referred by", "referral code", "invites"] },
  { key: "recovery", kind: "section", label: "Account recovery", tab: "support", anchor: "user-recovery", icon: LifeBuoy, keywords: ["lockout", "locked out", "passkey", "recovery"] },
  { key: "errors", kind: "section", label: "Errors", tab: "support", anchor: "user-errors", icon: CircleAlert, keywords: ["ref", "failures", "error lookup"] },
  { key: "support", kind: "section", label: "Support conversations", tab: "support", anchor: "user-support", icon: MessagesSquare, keywords: ["intercom", "chats", "tickets", "cases"] },
  { key: "audit", kind: "section", label: "Admin audit log", tab: "support", anchor: "user-audit-log", icon: FileClock, keywords: ["who changed", "admin actions", "history"] },

  { key: "freeze-card", kind: "action", label: "Freeze or unfreeze card", tab: "card", anchor: "user-card", icon: Snowflake, keywords: ["lock card", "block card"] },
  { key: "issue-card", kind: "action", label: "Issue or replace card", tab: "card", anchor: "user-card", icon: CreditCard, keywords: ["new card", "reissue", "compromised", "cancel card"] },
  { key: "unblock-spend", kind: "action", label: "Unblock card spend", tab: "card", anchor: "user-card", icon: ShieldCheck, keywords: ["spend block", "arrears", "sweep failed"] },
  { key: "card-holds", kind: "action", label: "Release card hold or collect settlement", tab: "card", anchor: "user-card", icon: Receipt, keywords: ["hold", "uncollected", "settlement"] },
  { key: "reset-kyc", kind: "action", label: "Reset KYC", tab: "card", anchor: "user-kyc", icon: RefreshCw, keywords: ["redo verification", "kyc retry"] },
  { key: "retry-virtual-account", kind: "action", label: "Retry virtual account onboarding", tab: "card", anchor: "user-virtual-account", icon: RefreshCw, keywords: ["stuck", "rain review"] },
  { key: "set-cashback-rate", kind: "action", label: "Set cashback rate", tab: "rewards", anchor: "user-cashback-rate", icon: Gift, keywords: ["override", "pin rate"] },
  { key: "reevaluate-cashback", kind: "action", label: "Re-evaluate failed cashback", tab: "rewards", anchor: "user-rewards-cashback", icon: RefreshCw, keywords: ["retry cashback", "missing cashback"] },
  { key: "gift-trial", kind: "action", label: "Gift a tier trial", tab: "rewards", anchor: "user-tier-trial", icon: Sparkles, keywords: ["prime", "ultra", "extend", "revoke"] },
  { key: "reevaluate-tier", kind: "action", label: "Re-evaluate tier lock", tab: "rewards", anchor: "user-tier", icon: RefreshCw, keywords: ["tier lock", "downgrade"] },
  { key: "reevaluate-referral", kind: "action", label: "Re-evaluate referral reward", tab: "rewards", anchor: "user-referrals", icon: RefreshCw, keywords: ["referral reward", "reversed", "expired"] },
  { key: "recover-account", kind: "action", label: "Recover closed account", tab: "overview", anchor: "user-profile", icon: LifeBuoy, keywords: ["reopen", "deleted account", "undelete"] },
  { key: "reset-2fa", kind: "action", label: "Reset two-factor", tab: "overview", anchor: "user-profile", icon: KeyRound, keywords: ["2fa", "authenticator", "totp"] },
  { key: "recovery-code", kind: "action", label: "Send recovery code or set email", tab: "support", anchor: "user-recovery", icon: KeyRound, keywords: ["change email", "recovery email", "locked out"] },
];

/** `/users/<id>?tab=card#user-kyc`. Overview is the default tab and stays out of the URL. */
export function userSectionHref(userId: string, tab: UserTab, anchor: string): string {
  const query = tab === "overview" ? "" : `?tab=${tab}`;
  return `/users/${userId}${query}#${anchor}`;
}

/** The open profile's sections and actions, for the search's "This user" group. */
export function userEntries(userId: string, displayName: string): SearchEntry[] {
  return USER_TARGETS.map((target) => ({
    id: `user:${userId}:${target.key}`,
    kind: target.kind,
    label: target.label,
    context: displayName,
    href: userSectionHref(userId, target.tab, target.anchor),
    icon: target.icon,
    keywords: [...(target.keywords ?? []), "user", target.tab],
  }));
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9@.]+/g, " ").trim();

/**
 * How well `query` matches an entry: 0 for not at all, higher is better.
 *
 * Deliberately not fuzzy. Every word typed has to appear in the entry — its
 * label, where it lives, its description or its keywords — so "kyc" never
 * matches "Key metrics". Within that, the label counts most, and a word the
 * label starts with beats one buried in the middle.
 */
export function scoreEntry(entry: SearchEntry, query: string): number {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return 0;

  const label = normalize(entry.label);
  const context = normalize(entry.context ?? "");
  const description = normalize(entry.description ?? "");
  const keywords = normalize((entry.keywords ?? []).join(" "));
  const labelWords = label.split(" ");

  let score = 0;
  for (const word of words) {
    if (label.startsWith(word)) score += 10;
    else if (labelWords.some((part) => part.startsWith(word))) score += 7;
    else if (label.includes(word)) score += 4;
    else if (keywords.split(" ").some((part) => part.startsWith(word))) score += 3;
    else if (context.includes(word)) score += 2;
    else if (keywords.includes(word) || description.includes(word)) score += 1;
    else return 0;
  }
  if (label === normalize(query)) score += 10;
  // A page outranks a section of the same strength: it is the broader answer.
  if (entry.kind === "page") score += 0.5;
  return score;
}

/** Entries matching `query`, best first. */
export function rankEntries(entries: SearchEntry[], query: string, limit: number): SearchEntry[] {
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((ranked) => ranked.entry);
}
