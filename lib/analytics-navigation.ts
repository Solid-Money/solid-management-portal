/**
 * The Analytics section's tabs and sub-tabs.
 *
 * One structure rather than routing logic spread across nine pages: the tab bar,
 * each page's sub-tab bar, and the default sub-tab a bare tab URL redirects to
 * all read from here, so adding a sub-tab is one edit.
 *
 * Sub-tabs live in a query param (`/analytics/revenue?tab=fees`) rather than in
 * the path, so a link to a specific view can be pasted into Slack and lands on
 * exactly that view.
 */

export interface AnalyticsSubTab {
  /** Value of the `tab` search param. */
  id: string;
  label: string;
  /** The one business question this sub-tab answers. */
  question: string;
  /**
   * Set when the sub-tab has no implementation yet.
   *
   * Spelled out per sub-tab rather than as a single "coming soon" page, so the
   * empty state can say which phase it lands in and what it is waiting on —
   * a blank tab with no explanation reads as a bug.
   */
  pending?: {
    phase: 2 | 3;
    /** What is blocking it, in one line. */
    blockedOn?: string;
  };
}

export interface AnalyticsTab {
  /** Route segment under `/analytics`. */
  id: string;
  label: string;
  /** The question the whole tab answers, shown under its heading. */
  question: string;
  subTabs: AnalyticsSubTab[];
}

export const ANALYTICS_TABS: AnalyticsTab[] = [
  {
    id: "overview",
    label: "Overview",
    question: "Is the business moving this week, and is anything on fire?",
    subTabs: [],
  },
  {
    id: "growth",
    label: "Growth",
    question: "Are we acquiring the right users, and do they stay?",
    subTabs: [
      {
        id: "users",
        label: "Users",
        question: "How many people are at each stage, and where are they?",
        pending: { phase: 2 },
      },
      {
        id: "acquisition",
        label: "Acquisition",
        question: "Where do our users come from, and what did each channel cost?",
        pending: {
          phase: 2,
          blockedOn:
            "Top-of-funnel attribution needs a GA4 or Supermetrics export; first-touch source is not stored as a user property yet.",
        },
      },
      {
        id: "retention",
        label: "Retention",
        question: "Do the users we acquire still deposit and spend weeks later?",
        pending: { phase: 2 },
      },
    ],
  },
  {
    id: "funnel",
    label: "Funnel",
    question:
      "Where do we lose people between signup and first spend, and where do deposits fail?",
    subTabs: [
      {
        id: "onboarding",
        label: "Onboarding",
        question: "Which step loses the most people?",
        pending: { phase: 2 },
      },
      {
        id: "rails",
        label: "Deposits by rail",
        question: "Which rails do deposits arrive on, and where do they fail?",
      },
      {
        id: "messaging",
        label: "Activation messaging",
        question: "Do our emails and pushes actually produce deposits?",
        pending: {
          phase: 2,
          blockedOn:
            "Brevo and Firebase attribution is unverified, and push opens are not tracked — only sends are.",
        },
      },
    ],
  },
  {
    id: "revenue",
    label: "Revenue",
    question:
      "What do we earn, from what, from whom, and does it cover what we spend to acquire them?",
    subTabs: [
      {
        id: "overview",
        label: "Overview",
        question: "What did we earn this period, and from which stream?",
      },
      {
        id: "fees",
        label: "Fee breakdown",
        question: "Which product earns what, and are we charging every fee we configured?",
      },
      {
        id: "vaults",
        label: "Vault economics",
        question: "What do the vaults generate, and what share do we keep?",
      },
      {
        id: "unit-economics",
        label: "Unit economics",
        question: "Does a funded user earn back what they cost us?",
        pending: {
          phase: 2,
          blockedOn:
            "Needs the per-user P&L table. Enter the cost inputs under costs config first — every unset input is a missing cost line.",
        },
      },
    ],
  },
  {
    id: "card",
    label: "Card",
    question:
      "Is the card being used, by whom, on which rail, and what does each rail cost us?",
    subTabs: [
      {
        id: "spending",
        label: "Spending",
        question: "How much is being spent, and on which rail?",
        pending: { phase: 2 },
      },
      {
        id: "issuance",
        label: "Issuance & activation",
        question: "Do the cards we issue get activated and used?",
        pending: { phase: 2 },
      },
      {
        id: "declines",
        label: "Declines & risk",
        question: "What is being declined, and is it abuse?",
        pending: { phase: 2 },
      },
      {
        id: "costs",
        label: "Rail costs",
        question: "What does each card rail cost us per active card and per dollar spent?",
        pending: {
          phase: 2,
          blockedOn: "Needs the Rain and Wirex contract costs entered under costs config.",
        },
      },
    ],
  },
  {
    id: "vaults",
    label: "Vaults",
    question: "Is money coming in and staying, and what is it earning users?",
    subTabs: [
      {
        id: "tvl",
        label: "TVL & flows",
        question: "Is TVL growing, and is it flows or price?",
      },
      {
        id: "yield",
        label: "Yield",
        question: "Does realised APY match what we communicate?",
        pending: { phase: 2 },
      },
      {
        id: "tiers",
        label: "Tiers & staking",
        question: "How many users hold each tier, and how much FUSE is locked for it?",
        pending: { phase: 2 },
      },
    ],
  },
  {
    id: "rewards",
    label: "Rewards",
    question: "What have we paid, what do we owe, and can we pay it?",
    subTabs: [
      {
        id: "paid",
        label: "Paid",
        question: "What have we actually paid out, and on what?",
      },
      {
        id: "owed",
        label: "Owed & upcoming",
        question: "What do we owe users that has not been paid yet?",
      },
      {
        id: "wallets",
        label: "Payout wallets",
        question: "Can the payout wallets cover what we owe, and for how long?",
      },
      {
        id: "referrals",
        label: "Referral program",
        question: "Who refers, who qualifies, and what does a referral cost us?",
      },
    ],
  },
  {
    id: "signals",
    label: "Signals",
    question: "Who are our users really, and what do they do that we did not intend?",
    subTabs: [
      {
        id: "segments",
        label: "Segments",
        question: "Which behaviour is each funded user showing, and what does it cost us?",
      },
      {
        id: "risk",
        label: "Risk & abuse",
        question: "Who should we be looking at, and has anyone reviewed them?",
        pending: {
          phase: 3,
          blockedOn: "Needs the watchlist collection with persisted reviewer status.",
        },
      },
      {
        id: "support",
        label: "Support & stability",
        question: "What are users contacting us about, and do errors precede it?",
        pending: { phase: 3, blockedOn: "Needs the Intercom and Sentry integrations." },
      },
      {
        id: "product",
        label: "Product signals",
        question: "Which features do active users actually use?",
        pending: { phase: 3 },
      },
      {
        id: "legacy-embeds",
        label: "Legacy embeds",
        question: "The Metabase dashboards these tabs are replacing.",
      },
    ],
  },
  {
    id: "investor",
    label: "Investor",
    question: "The monthly story in one screen, reconciling with every other tab.",
    subTabs: [
      {
        id: "monthly",
        label: "Monthly view",
        question: "What does this month look like to someone outside the company?",
      },
    ],
  },
];

/** A tab by route segment. */
export function analyticsTab(id: string): AnalyticsTab | undefined {
  return ANALYTICS_TABS.find((tab) => tab.id === id);
}

/**
 * The sub-tab a request resolves to.
 *
 * Falls back to the first sub-tab rather than erroring on an unknown `tab`
 * param: a stale link from Slack should land somewhere useful, not on a blank
 * page.
 */
export function resolveSubTab(
  tab: AnalyticsTab,
  requested: string | undefined
): AnalyticsSubTab | undefined {
  if (tab.subTabs.length === 0) return undefined;
  return (
    tab.subTabs.find((subTab) => subTab.id === requested) ?? tab.subTabs[0]
  );
}

/** Href for a tab, including its default sub-tab. */
export function analyticsHref(tab: AnalyticsTab): string {
  const [first] = tab.subTabs;
  return first ? `/analytics/${tab.id}?tab=${first.id}` : `/analytics/${tab.id}`;
}
