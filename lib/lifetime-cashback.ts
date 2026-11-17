import { formatCashbackTotals } from "@/lib/card-transactions";
import type { UserRewardsData } from "@/types";

/**
 * The app's "Lifetime cashback" — paid on every card the user has held, plus
 * what is still pending — as the admin rewards card shows it: dollars and euros
 * side by side, never summed.
 *
 * Undefined, hiding the stat, whenever a figure that should be there is
 * missing, so a partial total is never passed off as the whole one:
 * - the dollar figure is always reported by a backend that has lifetimes, so
 *   its absence is an older backend or a paid total it couldn't read;
 * - the euro figure is reported with the euro block (`cashbackEur`), so a euro
 *   block without one is a euro total that couldn't be read.
 *
 * No euro block means the user isn't on the euro lane: their euros are zero.
 */
export function lifetimeCashbackValue(
  rewards: Pick<UserRewardsData, "cashbackLifetime" | "cashbackEur">
): string | undefined {
  const usd = rewards.cashbackLifetime;
  if (typeof usd !== "number") return undefined;

  const eurBlock = rewards.cashbackEur;
  if (eurBlock && typeof eurBlock.cashbackLifetime !== "number") return undefined;

  return formatCashbackTotals(usd, eurBlock?.cashbackLifetime ?? 0);
}
