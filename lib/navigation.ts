import {
  Activity,
  BarChart3,
  BookOpen,
  CreditCard,
  DollarSign,
  Gift,
  Image,
  Megaphone,
  Percent,
  Receipt,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  /** One line explaining what the page is for, shown inside a submenu. */
  description: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** Present for a top-level link with no submenu. */
  href?: string;
  items?: NavLink[];
}

/**
 * The dashboard's navigation, grouped.
 *
 * Thirteen top-level links stretched the bar past the width of the window and
 * left it with a horizontal scrollbar; grouping them keeps every page one hover
 * away without the bar ever overflowing. Grouping is by the job being done —
 * who is this user / what happened / where is the money / what do we pay and
 * charge / what are we promoting — rather than by which service owns the data.
 *
 * Config is its own group rather than a corner of Growth: what we pay users and
 * what we charge them are set by different people at different times, and one
 * of the two moves real money out of their accounts.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Users",
    icon: Users,
    href: "/users",
  },
  {
    label: "Activity",
    icon: Activity,
    items: [
      {
        href: "/activity",
        label: "Activity Feed",
        description: "Every deposit, withdrawal and transfer across all users",
        icon: Activity,
      },
      {
        href: "/card-transactions",
        label: "Card Transactions",
        description: "Card spend with cashback and the fees charged on it",
        icon: CreditCard,
      },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    items: [
      {
        href: "/analytics/overview",
        label: "Overview",
        description: "Is the business moving, and is anything on fire",
        icon: BarChart3,
      },
      {
        href: "/analytics/revenue",
        label: "Revenue",
        description: "What we earn, from what, and from whom",
        icon: DollarSign,
      },
      {
        href: "/analytics/rewards",
        label: "Rewards",
        description: "What we have paid, what we owe, and whether we can pay it",
        icon: Gift,
      },
      {
        href: "/analytics/funnel",
        label: "Funnel",
        description: "Where users drop off, and where deposits fail",
        icon: TrendingUp,
      },
      {
        href: "/analytics/signals",
        label: "Signals",
        description: "User segments, and the Metabase dashboards being retired",
        icon: UsersRound,
      },
      {
        href: "/analytics/glossary",
        label: "Glossary",
        description: "What every metric on this dashboard actually means",
        icon: BookOpen,
      },
    ],
  },
  {
    label: "Treasury",
    icon: Wallet,
    items: [
      {
        href: "/wallets",
        label: "Wallets",
        description: "Admin wallet balances and what needs topping up",
        icon: Wallet,
      },
      {
        href: "/landing-apy",
        label: "Landing APY",
        description: "The APY figures shown on the marketing site",
        icon: TrendingUp,
      },
    ],
  },
  {
    label: "Config",
    icon: SlidersHorizontal,
    items: [
      {
        href: "/rewards-config",
        label: "Rewards",
        description: "Tiers, cashback rates, bonuses and referral rewards",
        icon: Gift,
      },
      {
        href: "/fees-config",
        label: "Fees",
        description: "Per-tier fee rates on every product we charge on",
        icon: Percent,
      },
      {
        href: "/costs-config",
        label: "Costs",
        description: "KYC, card and rail costs behind every margin number",
        icon: Receipt,
      },
    ],
  },
  {
    label: "Growth",
    icon: Megaphone,
    items: [
      {
        href: "/campaigns",
        label: "Campaigns",
        description: "Merchant cashback campaigns and their spend",
        icon: Megaphone,
      },
      {
        href: "/cohorts",
        label: "Cohorts",
        description: "User segments and email exports for lifecycle sends",
        icon: UsersRound,
      },
      {
        href: "/referrals",
        label: "Referral Lookup",
        description: "Who a referral code belongs to and who used it",
        icon: Share2,
      },
    ],
  },
  {
    label: "Content",
    icon: Sparkles,
    items: [
      {
        href: "/whats-new",
        label: "What's New",
        description: "The in-app release-notes carousel",
        icon: Sparkles,
      },
      {
        href: "/promotions-banner",
        label: "Promotions Banner",
        description: "Banners shown on the app's home and savings screens",
        icon: Image,
      },
      {
        href: "/scripts",
        label: "Scripts",
        description: "One-off maintenance jobs and backfills",
        icon: Terminal,
      },
    ],
  },
];

/** Every link in the navigation, flattened — used for active-state matching. */
export const NAV_LINKS: NavLink[] = NAV_GROUPS.flatMap((group) =>
  group.items ??
  (group.href
    ? [
        {
          href: group.href,
          label: group.label,
          description: "",
          icon: group.icon,
        },
      ]
    : [])
);

/** Whether `pathname` is inside `href` (so /users/123 lights up "Users"). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether any link in the group is the current page. */
export function isActiveGroup(pathname: string, group: NavGroup): boolean {
  if (group.href) return isActivePath(pathname, group.href);
  return (group.items ?? []).some((item) => isActivePath(pathname, item.href));
}
