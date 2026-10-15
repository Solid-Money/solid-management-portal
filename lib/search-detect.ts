import type { CardSearchMatch, User } from "@/types";

/**
 * Reading what an admin pasted into the search, so the right result is first.
 *
 * Most searches are pastes from a ticket or a chat — an email, a wallet, a
 * card id, a Ref — and for those the user search is the answer. A word typed
 * by hand ("kyc", "fees") is usually a place in the dashboard.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const EVM_ADDRESS = /^0x[a-f0-9]{40}$/i;
const UUID_LIKE = /^[a-f0-9]{8}-[a-f0-9-]{4,}$/i;
const EMAIL_LIKE = /^[^\s@]+@[^\s@]*$/;

export const isUserId = (query: string): boolean => OBJECT_ID.test(query.trim());

/**
 * Whether `query` reads as an identifier rather than words: an email, an
 * address, a user id, a card id, or any single token mixing letters and
 * digits. Those go to the user search first.
 */
export function looksLikeIdentifier(query: string): boolean {
  const value = query.trim();
  if (!value || /\s/.test(value)) return false;
  return (
    EMAIL_LIKE.test(value) ||
    EVM_ADDRESS.test(value) ||
    value.toLowerCase().startsWith("0x") ||
    OBJECT_ID.test(value) ||
    UUID_LIKE.test(value) ||
    (value.length >= 6 && /\d/.test(value) && /[a-z]/i.test(value))
  );
}

/** A single word that could be a referral code, for the referral lookup. */
export const couldBeReferralCode = (query: string): boolean =>
  /^[A-Za-z0-9_-]{3,32}$/.test(query.trim());

const CARD_FIELD_LABELS: Record<CardSearchMatch["field"], string> = {
  card_id: "card ID",
  previous_card_id: "previous card ID",
  wirex_user_id: "Wirex user ID",
  provider_user_id: "Rain user ID",
};

export const PROVIDER_LABELS: Record<string, string> = {
  rain: "Rain",
  wirex: "Wirex",
  bridge: "Bridge",
};

/** `3f2a9c1e-77b0-…` → `3f2a9c1e…4e5f`, short enough for one line. */
export const abbreviateId = (value: string): string =>
  value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

/**
 * Why a search result is a match, when the row does not make it obvious:
 * a card id, an address or a referral code is not otherwise on the result.
 * Null when the name or email already shows it.
 */
export function describeMatch(user: User, query: string): string | null {
  if (user.cardMatch) {
    const provider = PROVIDER_LABELS[user.cardMatch.provider] ?? user.cardMatch.provider;
    return `${provider} ${CARD_FIELD_LABELS[user.cardMatch.field]} ${abbreviateId(user.cardMatch.value)}`;
  }
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const has = (value?: string | null) => !!value && value.toLowerCase().includes(needle);
  if (has(user.username) || has(user.email)) return null;
  if (user._id === query.trim()) return "User ID";
  if (has(user.walletAddress)) return `Wallet ${abbreviateId(user.walletAddress!)}`;
  if (has(user.safeAddress)) return `Safe ${abbreviateId(user.safeAddress!)}`;
  if (has(user.referralCode)) return `Own referral code ${user.referralCode}`;
  if (has(user.referralCodeUsed)) return `Signed up with code ${user.referralCodeUsed}`;
  return null;
}
