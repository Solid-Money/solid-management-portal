/**
 * The definitions behind every number in Analytics.
 *
 * One place, so a metric cannot mean two things in two tabs. Every metric label
 * in the UI renders through `MetricLabel`, which looks its definition up here
 * and shows it on hover — the definition travels with the number instead of
 * living in a document nobody has open.
 *
 * Where a definition names a collection or an event, that is deliberate: the
 * point of a shared glossary is that "active user" resolves to a query, not to
 * an intuition.
 */
export interface GlossaryEntry {
  /** The term as it appears in the UI. */
  term: string;
  definition: string;
  /**
   * Where the number comes from, in prose. Distinct from the source badge,
   * which names the system; this names the records.
   */
  source?: string;
  /**
   * A caveat that changes how the number should be read — a known gap, a
   * scope limit, an instrumentation problem.
   */
  caveat?: string;
}

export type GlossaryKey =
  | "registeredUser"
  | "kycdUser"
  | "fundedUser"
  | "activeUser"
  | "spendingUser"
  | "revenue"
  | "incentiveCost"
  | "cac"
  | "ltv"
  | "cardSpending"
  | "aum"
  | "waivedFee"
  | "goodCustomer"
  | "cardDeposit"
  | "settledSpend"
  | "registration"
  | "referredUser"
  | "platform"
  | "tvl"
  | "internalAccount"
  | "week"
  | "accruedCashback"
  | "pendingReferral"
  | "qualifiedUnpaid"
  | "pointsLiability"
  | "payoutRunway"
  | "qualificationRate";

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  registeredUser: {
    term: "Registered user",
    definition: "Completed signup.",
  },
  kycdUser: {
    term: "KYC'd user",
    definition:
      "KYC approved by Didit, and by the card issuer where one is involved.",
  },
  fundedUser: {
    term: "Funded user",
    definition: "At least one successful deposit, on any rail, of any amount.",
  },
  activeUser: {
    term: "Active user (30d)",
    definition:
      "A funded user with at least one card transaction, deposit, swap, FX conversion, or Savings deposit or withdrawal in the last 30 days.",
    caveat:
      "Holding a balance is not activity. This is the definition everywhere 'active' appears, including tickets per 100 active users.",
  },
  spendingUser: {
    term: "Spending user",
    definition:
      "An active user with at least one successful card transaction in the period.",
  },
  revenue: {
    term: "Revenue",
    definition:
      "Product fees charged, net of waived, plus the protocol share of vault yield, plus treasury interest on company wallets, plus Solid's FX margin on Wirex once live.",
    caveat:
      "Excludes yield paid to users and FUSE price movements. Every revenue KPI states its own date range — the three older revenue reads on this dashboard each used a different one.",
  },
  incentiveCost: {
    term: "Incentive cost",
    definition:
      "Cashback plus referral payouts plus subscription cashback plus points valued at the configured conversion rate, at USD value on the payment date.",
  },
  cac: {
    term: "CAC (fully loaded)",
    definition:
      "(KYC costs + card issuance costs + referral payout + first-30-day cashback) ÷ funded users acquired in the period.",
    caveat:
      "Only as complete as the cost inputs entered under costs config. Any unset input is reported rather than assumed to be zero.",
  },
  ltv: {
    term: "LTV",
    definition:
      "Revenue per funded user over the trailing 90 days × 4, until 12 months of data exist.",
    caveat: "An extrapolation, not an observation. The method is shown with the number.",
  },
  cardSpending: {
    term: "Card spending",
    definition:
      "Successful, settled card transactions in USD, both rails, excluding declines and reversals.",
  },
  aum: {
    term: "AUM",
    definition: "Solid balance plus Savings vault balances, in USD at current prices.",
  },
  waivedFee: {
    term: "Waived fee",
    definition:
      "A fee computed below $0.01, or set to 0 by the user's tier, recorded with amount 0.",
    caveat:
      "Never added to revenue. Shown as a band above charged fees — revenue we were entitled to and did not collect.",
  },
  goodCustomer: {
    term: "Good customer",
    definition:
      "A user with 2 or more settled card purchases in the window, across Rain and Wirex.",
    caveat: "Window-scoped, not lifetime: the same user can qualify one month and not the next.",
  },
  cardDeposit: {
    term: "Card deposit",
    definition:
      "Rain collateral posted, or a stablecoin receive into the Wirex card wallet.",
    caveat:
      "Wirex spend draws on the wallet balance, so it has no deposit step. That reads as n/a, never 0.",
  },
  settledSpend: {
    term: "Settled spend",
    definition:
      "Rain card transactions in settled or approved status; Wirex cash operations in SWEEP_CONFIRMED.",
    caveat: "Declines are never volume.",
  },
  registration: {
    term: "Registration",
    definition: "The Amplitude `Account Created` server event.",
    caveat: "Never `Signup Completed`, which is broken.",
  },
  referredUser: {
    term: "Referred user",
    definition: "A user whose `referralCodeUsed` is non-empty.",
    caveat:
      "This is the attribution of record: it survives referrer stripping by the X and Telegram in-app browsers, which is why referred traffic reads as direct in client-side data.",
  },
  platform: {
    term: "Platform",
    definition: "The user-level most-recent platform property in Amplitude.",
    caveat: "Card webhooks carry no platform, so card events cannot be split this way.",
  },
  tvl: {
    term: "TVL",
    definition:
      "Two series, always labelled: flow-based, the running sum of vault deposit and withdrawal events at their value when they happened; and marked-to-market, on-chain vault balances at current price.",
    caveat:
      "The flow-based series is not marked to market, so it does not move with price. The two legitimately differ.",
  },
  internalAccount: {
    term: "Internal account",
    definition:
      "A @fuse.io email address, or a member of the Wirex team allowlist.",
    caveat: "Excluded from every metric.",
  },
  week: {
    term: "Week",
    definition: "Monday to Sunday.",
    caveat: "The current week is partial and is marked as such.",
  },
  accruedCashback: {
    term: "Accrued cashback",
    definition:
      "Cashback earned on settled spend and not yet credited — rows still in escrow, bucketed by the date each is scheduled to pay.",
    caveat:
      "Escrowed rows are priced at payout, so this is projected from the rate frozen onto each row when it accrued. Rows too old to carry a rate contribute their spend instead, reported separately.",
  },
  pendingReferral: {
    term: "Pending referral",
    definition:
      "A referred friend who has signed up and not yet met the bar, with their qualify window still open.",
    caveat:
      "Reported at full value and risk-adjusted by the historical qualification rate. The first is what the payout wallet must be able to cover; the second is the forecast.",
  },
  qualifiedUnpaid: {
    term: "Qualified, unpaid",
    definition:
      "A referral that has met the bar and is waiting out the payout delay that covers disputes and chargebacks.",
    caveat: "This money is committed. Anything past its due date is a late payout, not a forecast.",
  },
  pointsLiability: {
    term: "Points liability",
    definition:
      "Points issued and not yet redeemed, valued at the conversion rate set in costs config.",
    caveat:
      "The rate is an assumption, not a price — there is no market before TGE. Unset by default, and the panel says so rather than valuing points at zero.",
  },
  payoutRunway: {
    term: "Payout runway",
    definition:
      "Payout wallet balance ÷ its trailing 7-day average daily outflow, in days.",
    caveat:
      "The cashback wallet also receives Wirex card spend, so its inflows and outflows are shown separately.",
  },
  qualificationRate: {
    term: "Qualification rate",
    definition:
      "Referrals that ever qualified ÷ referrals whose qualify window has closed.",
    caveat:
      "Referrals still inside their window are excluded from both sides. Counting them as misses would drag the rate down by however fast we are growing.",
  },
};

/** Look up an entry, tolerating a key that has no definition yet. */
export function glossary(key: GlossaryKey): GlossaryEntry | undefined {
  return GLOSSARY[key];
}

/** Every entry, alphabetically — the glossary page's list. */
export function glossaryEntries(): Array<GlossaryEntry & { key: GlossaryKey }> {
  return (Object.keys(GLOSSARY) as GlossaryKey[])
    .map((key) => ({ key, ...GLOSSARY[key] }))
    .sort((a, b) => a.term.localeCompare(b.term));
}
