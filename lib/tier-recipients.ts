import { formatDateTime } from "@/lib/utils";

const TIER_NAMES: Record<number, string> = {
  1: "Core",
  2: "Prime",
  3: "Ultra",
};

/**
 * "Core" / "Prime" / "Ultra" for a tier rank as the tier-email endpoints take
 * it (1 = Core, 2 = Prime, 3 = Ultra); falls back to "Tier N".
 */
export function tierRankName(tier: number): string {
  return TIER_NAMES[tier] ?? `Tier ${tier}`;
}

/**
 * Where the tier-email recipients come from, for the line under the count.
 *
 * Recipients are the users who hold the tier — by a FUSE lock, a USDC
 * membership, a trial or a grandfathered route — as of the latest daily tier
 * snapshot. Points no longer decide a tier, so they are not part of it.
 */
export function tierRecipientsSource(asOf: string | null | undefined): string {
  if (!asOf) {
    return "No daily tier snapshot yet, so nobody can be matched to a tier.";
  }
  return `By the tier each user holds, as of the daily snapshot taken ${formatDateTime(asOf)}.`;
}
