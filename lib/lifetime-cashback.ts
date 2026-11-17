import { formatCashbackTotals } from "@/lib/card-transactions";
import type { UserRewardsData } from "@/types";

/**
 * The app's "Lifetime cashback" — paid on every card the user has held, plus
 * what is still pending — as the admin rewards card shows it: dollars and euros
 * side by side, never summed.
 *
 * A backend that has lifetimes reports both, for every user whatever their
 * currency (0 without a card), so euros earned before a switch to dollars
 * still show. A missing one is an older backend or a total it couldn't read,
 * not zero: the stat is then hidden rather than passing a partial total off as
 * the whole one.
 */
export function lifetimeCashbackValue(
  rewards: Pick<UserRewardsData, "cashbackLifetime" | "cashbackLifetimeEur">
): string | undefined {
  const usd = rewards.cashbackLifetime;
  const eur = rewards.cashbackLifetimeEur;
  if (typeof usd !== "number" || typeof eur !== "number") return undefined;

  return formatCashbackTotals(usd, eur);
}
