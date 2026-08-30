import {
  Activity,
  BarChart3,
  CreditCard,
  DollarSign,
  Gift,
  Image,
  LayoutTemplate,
  Megaphone,
  Share2,
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
 * left it with a horizontal scrollbar; grouping them into five entries keeps
 * every page one hover away without the bar ever overflowing. Grouping is by
 * the job being done — who is this user / what happened / where is the money /
 * what are we promoting — rather than by which service owns the data.
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
        href: "/revenue",
        label: "Revenue",
        description: "Fees, yields and the investor-facing summary",
        icon: DollarSign,
      },
      {
        href: "/analytics",
        label: "Analytics",
        description: "Protocol charts: TVL, flows, exchange rate",
        icon: BarChart3,
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
    label: "Growth",
    icon: Gift,
    items: [
      {
        href: "/rewards-config",
        label: "Rewards Config",
        description: "Tiers, cashback rates, card fees and bonuses",
        icon: Gift,
      },
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
      {
        href: "/artifacts",
        label: "Claude Artifacts",
        description: "Dashboards and reports published from Claude, embedded",
        icon: LayoutTemplate,
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
