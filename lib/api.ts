import axios from "axios";
import { auth } from "./firebase";
import { toast } from "sonner";
import { formatErrorRef, requestIdOf } from "@/lib/error-ref";
import {
  AdminAuditEntry,
  AdminUserReferrals,
  ClientErrorMatch,
  ClientErrorReport,
  BatchIssueTierTrialRequest,
  BatchIssueTierTrialResult,
  CardAuditEntry,
  CardIssuanceContext,
  FullRewardsConfig,
  IssueCardRequest,
  IssueCardResult,
  RainRtfStatus,
  IssueTierTrialRequest,
  IssueTierTrialResult,
  InternalTeamFeatureKey,
  InternalTeamMember,
  InternalTeamRoster,
  KycResetEligibility,
  KycResetResult,
  VirtualAccountOnboardingRetryResult,
  VirtualAccountOnboardingState,
  VirtualAccountProvider,
  VirtualAccountRemovalResult,
  VirtualAccountRemovalState,
  RecoverAccountResult,
  RecoveryEligibility,
  ResetTwoFactorResult,
  SendRecoveryCodeResult,
  SetAccountEmailResult,
  TwoFactorStatus,
  ReferralReevaluationResult,
  SetTransactionCashbackPercentageResult,
  SetUserCashbackPercentageResult,
  ReevaluateFailedCashbackResult,
  TierTrial,
  TierLockReevaluationResult,
  TierMembershipView,
  TierTrialView,
} from "@/types";

declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * Skip the global error toast: for background reads (polling, side
     * cards) whose screen shows its own state when they fail.
     */
    quietErrors?: boolean;
  }
}
import {
  CardHolds,
  ReleaseCardHoldRequest,
  ReleaseCardHoldResult,
} from "@/types/cash-holds";
import {
  CollectSettlementRequest,
  CollectSettlementResult,
  UncollectedSettlements,
} from "@/types/cash-collect";
import type {
  AdminCardCredit,
  AdminReferralV4Debt,
  AdminReferralV4Reward,
  AdminUserReferralsV4,
  CardCreditAdjustment,
  ReferralBoostAdmin,
  ReferralBoostInput,
  ReferralReviewDecisionRequest,
  ReferralReviewDecisionResult,
  ReferralReviewQueue,
  ReferralV4Access,
  ReferralV4Analytics,
} from "@/types/referral-v4";

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL || "http://localhost:5009",
});

// Add Firebase ID token to all requests
api.interceptors.request.use(
  async (config) => {
    if (auth) {
      const user = auth.currentUser;
      if (user) {
        try {
          console.log("[API] Getting Firebase ID token for request...");
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
          console.log("[API] Token attached to request");
        } catch (error) {
          console.error("[API] Failed to get ID token:", error);
        }
      } else {
        console.warn(
          "[API] No user signed in, request will be sent without auth",
        );
      }
    }
    return config;
  },
  (error) => {
    console.error("[API] Request interceptor error:", error);
    return Promise.reject(error);
  },
);

/**
 * The backend's own reason for a failed admin call. Validation errors arrive as
 * an array of messages; axios's "Request failed with status code 500" says
 * nothing an admin can act on, so it is replaced.
 */
export function describeApiError(error: unknown): string {
  const response = (
    error as { response?: { status?: number; data?: { message?: unknown } } }
  )?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) {
    const joined = message.filter((m) => typeof m === "string").join(" ");
    if (joined) return joined;
  }
  if (typeof message === "string" && message.trim()) return message;
  if (!response) return "Couldn't reach the server. Check your connection.";
  return `The server couldn't complete this (${response.status ?? "error"}).`;
}

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.config?.quietErrors) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      console.error(
        "[API] Unauthorized request - token may be invalid or expired",
      );
      toast.error("Session expired. Please sign in again.", {
        id: "session-expired",
      });
    } else {
      const message = describeApiError(error);
      // The request ID ties this toast to the backend's log lines
      // (`rid=<id>` in Loki); shown as the same short Ref the app uses.
      const requestId = requestIdOf(error);
      const ref = requestId ? formatErrorRef(requestId) : undefined;
      toast.error(message, {
        // One toast per distinct failure: retries and duplicate calls update it
        // instead of stacking copies.
        id: `api-error:${error.response?.status ?? "network"}:${message}`,
        description: ref ? `Ref ${ref}` : undefined,
        // The full request ID: unambiguous in Loki and GlitchTip, where the
        // 8-character Ref may match more than one event.
        action: requestId
          ? {
              label: "Copy ID",
              onClick: () => void navigator.clipboard?.writeText(requestId),
            }
          : undefined,
      });
    }
    return Promise.reject(error);
  },
);

// --- User detail page ------------------------------------------------------

export const getUserCard = (userId: string) =>
  api.get(`/admin/v1/users/${userId}/card`);

export const getUserSavings = (userId: string) =>
  api.get(`/admin/v1/users/${userId}/savings`);

export const getUserRewards = (userId: string) =>
  api.get(`/admin/v1/users/${userId}/rewards`);

export const getUserCashback = (userId: string) =>
  api.get(`/admin/v1/users/${userId}/cashback`);

export const getUserIntercomHistory = (userId: string) =>
  api.get(`/admin/v1/users/${userId}/intercom`);

/**
 * Every admin action on this user's card — frozen, unfrozen, canceled,
 * issued — newest first.
 *
 * Wider than the freeze history on purpose: a cancel and the issue that
 * followed it are one replacement, and either half read alone tells the wrong
 * story about why this cardholder's card looks the way it does.
 */
export const getCardAuditHistory = (userId: string) =>
  api.get<{ data: CardAuditEntry[] }>(
    `/admin/v1/users/${userId}/card/audit-history`,
  );

/**
 * Real-Time Funding: whether this cardholder's wallet is authorized to be
 * pulled from at swipe time, on which chains, and for which spenders.
 *
 * The allowances come back read live from the chain. That is the point of
 * having this on the user page at all — our own record says only that the
 * cardholder once consented, and "they revoked it from MetaMask yesterday" is
 * exactly the case support gets called about.
 */
export const getUserRtf = (userId: string) =>
  api.get<{ data: RainRtfStatus }>(`/admin/v1/users/${userId}/rtf`);

/**
 * What the issue-card dialog opens with: the card this user holds today, and
 * the name, spend limit and shipping address a replacement should start from.
 *
 * Read when the dialog opens rather than with the card panel — it calls the
 * issuer for the live card and the cardholder record, which is worth doing
 * when support is about to act on it and not on every page view.
 */
export const getCardIssuanceContext = (userId: string) =>
  api.get<{ data: CardIssuanceContext }>(
    `/admin/v1/users/${userId}/card/issuance-context`,
  );

/**
 * Issue a card to this user, cancelling the one they hold first unless
 * `cancelExisting` says otherwise.
 *
 * This is the answer to a cardholder whose card details have leaked: the app
 * only offers a freeze, and a frozen card still carries the leaked number.
 * Cancelling is irreversible, and the backend does it *before* issuing — if
 * the cancel fails nothing is issued, so the user is never left holding the
 * compromised card alongside a new one.
 *
 * The admin identity comes from the Firebase token server-side, never from
 * here, so the audit row names whoever is actually signed in.
 */
export const issueUserCard = (userId: string, request: IssueCardRequest) =>
  api.post<{ data: IssueCardResult }>(
    `/admin/v1/users/${userId}/card/issue`,
    request,
  );

/**
 * Freeze or unfreeze a user's card. The admin identity is taken from the
 * Firebase token server-side — never sent from here — so the audit row and the
 * Slack message name whoever is actually signed in.
 */
export const setUserCardFreeze = (
  userId: string,
  freeze: boolean,
  reason?: string,
) =>
  api.post(`/admin/v1/users/${userId}/card/freeze`, {
    freeze,
    ...(reason ? { reason } : {}),
  });

/**
 * Lift the card-spend block a failed sweep put on a Safe.
 *
 * Only clears the block. The arrears hold stays pinned and keeps reducing
 * the card's spending power, so this is for once the debt is recovered or
 * written off, not a way to let the user spend it again. The admin identity
 * comes from the Firebase token server-side.
 */
export const unblockCardSpend = (safeAddress: string) =>
  api.post<{ unblocked: boolean }>(
    `/admin/v1/cash-ops/safes/${safeAddress}/unblock`,
  );

/**
 * Everything reserved against this user's card spending power, on every
 * instance, each joined to its payment and marked stale when nothing will
 * ever clear it.
 */
export const getUserCardHolds = (userId: string) =>
  api.get<CardHolds>(`/admin/v1/cash-ops/users/${userId}/holds`);

/**
 * Release one hold-store entry, handing its amount back to the card. Refused
 * with a 409 when the entry changed since it was loaded, so re-read and
 * check it again. The admin identity comes from the Firebase token
 * server-side.
 */
export const releaseUserCardHold = (
  userId: string,
  uniqueOperationId: string,
  body: ReleaseCardHoldRequest,
) =>
  api.post<ReleaseCardHoldResult>(
    `/admin/v1/cash-ops/users/${userId}/holds/${uniqueOperationId}/release`,
    body,
  );

/**
 * Card spends Wirex paid for that we never swept from this user's Safe, with
 * what the Safe can cover right now.
 */
export const getUserUncollectedSettlements = (userId: string) =>
  api.get<UncollectedSettlements>(
    `/admin/v1/cash-ops/users/${userId}/uncollected`,
  );

/**
 * Collect one of them: books the debit and starts the normal sweep from the
 * user's Safe. Refused with a 409 when the Safe cannot cover it, unless
 * `force` is set. The admin identity comes from the Firebase token
 * server-side.
 */
export const collectUserSettlement = (
  userId: string,
  uniqueOperationId: string,
  body: CollectSettlementRequest,
) =>
  api.post<CollectSettlementResult>(
    `/admin/v1/cash-ops/users/${userId}/uncollected/${uniqueOperationId}/collect`,
    body,
  );

/**
 * This user's tier trials: the one that is open — waiting to be started or
 * running — plus the history behind it.
 *
 * Read before offering the gift form: an open trial is what makes the operator
 * choose between replacing it and extending it, and the backend refuses a gift
 * that does not say which.
 */
export const getUserTierTrials = (userId: string) =>
  api.get<{ data: TierTrialView }>(`/admin/v1/users/${userId}/tier-trial`);

/**
 * This user's tier membership: what they have locked, what they are paying for,
 * and the history behind both.
 *
 * The same payload the app renders, deliberately — the first question support
 * is asked about a tier is "why am I not Prime?", and answering it means
 * looking at exactly what the user is looking at. The lock figures are read
 * from the chain on every request rather than from a cache of it.
 */
export const getUserTierMembership = (userId: string) =>
  api.get<{ data: TierMembershipView }>(
    `/admin/v1/users/${userId}/tier-membership`,
  );

/**
 * Re-read a user's locked FUSE from the chain and record what each tranche was
 * worth when it was locked, so the tier stops following the live soFUSE rate.
 * Only ever holds a tier up; safe to repeat. The admin's name on the audit row
 * comes from the Firebase token, never from here.
 */
export const reevaluateTierLock = (userId: string, reason?: string) =>
  api.post<{ data: TierLockReevaluationResult }>(
    `/admin/v1/users/${userId}/tier-lock/reevaluate`,
    { reason: reason || undefined },
  );

/**
 * Gift this user a temporary tier upgrade.
 *
 * The trial is issued waiting for the user to accept it — the duration runs
 * from their activation, not from now — and grants its tier on top of whatever
 * their points and FUSE balance already earn, without touching either. When it
 * ends they simply return to their earned tier.
 *
 * `onExistingTrial` is required when the user already has one open: pass
 * `replace` to swap their trial for this one, or `extend` to add these days to
 * it at the tier it already grants.
 *
 * The admin identity comes from the Firebase token server-side, never from
 * here, so the audit row names whoever is actually signed in.
 */
export const issueUserTierTrial = (
  userId: string,
  request: IssueTierTrialRequest,
) =>
  api.post<{ data: IssueTierTrialResult }>(
    `/admin/v1/users/${userId}/tier-trial`,
    request,
  );

/**
 * Gift the same tier trial to a list of users, named by username.
 *
 * Succeeds as a whole and reports per user: the response carries a row for
 * every line submitted saying whether it was gifted, extended, replaced,
 * skipped because they already had a trial, not found, or failed — so one
 * mistyped username costs that line and nothing else. Only a gift that is
 * wrong for everybody — a duration outside the bounds, an empty list — is
 * refused outright, before anything has been issued.
 *
 * `onExistingTrial` decides once, for the whole batch, what happens to the
 * users who already hold a trial. Omitted, they are left alone.
 */
export const batchIssueTierTrials = (request: BatchIssueTierTrialRequest) =>
  api.post<{ data: BatchIssueTierTrialResult }>(
    "/admin/v1/users/tier-trial/batch",
    request,
  );

/**
 * Take a tier trial back — one the user has not opened, or one already running.
 * Either way they return to the tier their points and FUSE balance earn them.
 */
export const revokeUserTierTrial = (
  userId: string,
  options: { trialId?: string; reason?: string } = {},
) =>
  api.post<{ data: TierTrial }>(
    `/admin/v1/users/${userId}/tier-trial/revoke`,
    options,
  );

/**
 * Put this user's PermanentlyFailed cashback back in the retry queue. The
 * retry cron pays it through the normal payout path within 30 minutes; safe to
 * repeat. The admin's name on the audit row comes from the Firebase token.
 */
export const reevaluateFailedCashback = (userId: string, reason?: string) =>
  api.post<{ data: ReevaluateFailedCashbackResult }>(
    `/admin/v1/users/${userId}/cashback/reevaluate`,
    { reason: reason || undefined },
  );

/**
 * Pin a cashback rate to this cardholder, or clear it by passing `null`.
 *
 * The rate is a fraction, not a percent — 0.03 is 3% — matching how tier rates
 * are stored. It overrides what their tier pays for every purchase from now on;
 * escrows already outstanding keep the rate they were created at.
 *
 * The admin identity comes from the Firebase token server-side, never from
 * here, so the audit row names whoever is actually signed in.
 */
export const setUserCashbackPercentage = (
  userId: string,
  percentage: number | null,
  reason?: string,
) =>
  api.post<{ data: SetUserCashbackPercentageResult }>(
    `/admin/v1/users/${userId}/cashback-percentage`,
    { percentage, ...(reason ? { reason } : {}) },
  );

/**
 * Pin a cashback rate to one purchase, or clear it by passing `null`.
 *
 * The most specific of the three levels: it outranks the cardholder's own rate
 * and their tier's. When the purchase's cashback has already accrued and is
 * still owed, that row is re-priced too — the result says whether it was.
 */
export const setTransactionCashbackPercentage = (
  transactionId: string,
  percentage: number | null,
  reason?: string,
) =>
  api.post<SetTransactionCashbackPercentageResult>(
    `/admin/v1/card-transactions/${encodeURIComponent(
      transactionId,
    )}/cashback-percentage`,
    { percentage, ...(reason ? { reason } : {}) },
  );

/**
 * Reopen an account its owner closed with the in-app "Delete account".
 *
 * Closure never removed what the account is made of — the passkeys, the Safe
 * and its funds, activity and rewards — so this lets the user sign straight
 * back in with the passkey they already have. The reason is required: it is
 * written to the audit trail and posted to Slack with the admin's name.
 *
 * Refused with a 409 for an account that is not closed. The admin identity
 * comes from the Firebase token server-side, never from here.
 */
export const recoverUserAccount = (userId: string, reason: string) =>
  api.post<{ data: RecoverAccountResult }>(
    `/admin/v1/users/${userId}/account/recover`,
    { reason },
  );

/**
 * Whether this user's identity verification can be cleared so they can start a
 * new one, and what is in the way when it cannot. Read-only — it also carries
 * the provider's reason codes, so the card can show why they were declined.
 */
export const getKycResetEligibility = (userId: string) =>
  api.get<{ data: KycResetEligibility }>(
    `/admin/v1/users/${userId}/kyc/reset-eligibility`,
  );

/**
 * Clear a declined identity verification so the user can start a new one.
 *
 * Narrow by design: it clears our record of the decision and nothing else — no
 * issuer consumer is deleted, no card is touched, and the provider's own
 * decision is not overturned. The reason is required; it is written to the
 * audit trail with the admin's name, and refusals are recorded too.
 */
export const resetKycVerification = (userId: string, reason: string) =>
  api.post<{ data: KycResetResult }>(`/admin/v1/users/${userId}/kyc/reset`, {
    reason,
  });

/**
 * Where this user's Rain virtual-account onboarding is stuck, and who has to act
 * next. Read-only; asks Didit for the live session status when our record lags.
 */
export const getVirtualAccountOnboarding = (userId: string) =>
  api.get<{ data: VirtualAccountOnboardingState }>(
    `/admin/v1/users/${userId}/virtual-account/onboarding`,
  );

/**
 * Re-submit a Didit-approved virtual-account application that never reached
 * Rain. Refused (409) unless that is the step the user is stuck on; audited
 * either way.
 */
export const retryVirtualAccountOnboarding = (
  userId: string,
  reason?: string,
) =>
  api.post<{ data: VirtualAccountOnboardingRetryResult }>(
    `/admin/v1/users/${userId}/virtual-account/onboarding/retry`,
    reason ? { reason } : {},
  );

/**
 * Each provider's virtual-account data for this user — Rain's USD account and
 * Wirex's EUR IBAN — and whether support can remove it. Read-only.
 */
export const getVirtualAccountRemoval = (userId: string) =>
  api.get<{ data: VirtualAccountRemovalState }>(
    `/admin/v1/users/${userId}/virtual-account/removal`,
  );

/**
 * Remove one provider's virtual-account data, so the user can open the other
 * provider's account (or to clear a leftover application). Deletes data at
 * Rain that cannot be restored; refused (409) where a card shares the
 * verification. Audited either way.
 */
export const removeVirtualAccountData = (
  userId: string,
  provider: VirtualAccountProvider,
  reason: string,
) =>
  api.post<{ data: VirtualAccountRemovalResult }>(
    `/admin/v1/users/${userId}/virtual-account/remove`,
    { provider, reason },
  );

/** Every admin action taken on this user, newest first. */
export const getUserAuditLog = (userId: string) =>
  api.get<{ data: AdminAuditEntry[] }>(`/admin/v1/users/${userId}/audit-log`);

/**
 * The failures behind an error Ref a user shared (`9C1B-4F2A`), or behind a
 * full GlitchTip event ID or request ID. An 8-character Ref can repeat over
 * months, so each match carries its user.
 */
export const lookupClientErrors = (query: string) =>
  api.get<{ data: ClientErrorMatch[] }>("/admin/v1/errors", {
    params: { query },
  });

/** The failures the app showed this user, newest first. */
export const getUserClientErrors = (userId: string, limit = 20) =>
  api.get<{ data: ClientErrorReport[] }>(`/admin/v1/errors/users/${userId}`, {
    params: { limit },
  });

/**
 * Whether this user can get back in on their own, and what is stopping them.
 * Read-only — the first thing to check on a lockout ticket.
 */
export const getRecoveryEligibility = (userId: string) =>
  api.get<{ data: RecoveryEligibility }>(
    `/admin/v1/users/${userId}/account/recovery-eligibility`,
  );

/**
 * Mail a recovery code to the account's own address, for a user who cannot
 * reach the recovery screen. The code never comes back to us.
 */
export const sendRecoveryCode = (userId: string, reason: string) =>
  api.post<{ data: SendRecoveryCodeResult }>(
    `/admin/v1/users/${userId}/account/send-recovery-code`,
    { reason },
  );

/**
 * Set or correct the address this account recovers through. Whoever holds it
 * can start a recovery, so this is only ever used once the request has been
 * tied to the account's owner some other way.
 */
export const setAccountEmail = (
  userId: string,
  email: string,
  reason: string,
) =>
  api.post<{ data: SetAccountEmailResult }>(
    `/admin/v1/users/${userId}/account/email`,
    { email, reason },
  );

/**
 * Whether this user has authenticator-app 2FA, when it was set up and last
 * used, and whether wrong codes have locked it. Read-only; never the secret.
 */
export const getTwoFactorStatus = (userId: string) =>
  api.get<{ data: TwoFactorStatus }>(
    `/admin/v1/users/${userId}/account/two-factor`,
  );

/**
 * Remove this user's authenticator-app 2FA, for an owner who lost the device
 * it lived on. Sends stop asking for a code until they set 2FA up again, so it
 * is only ever run once the request has been tied to the owner. The reason is
 * required; it is written to the audit trail and posted to Slack with the
 * admin's name. Refused with a 409 when there is nothing to reset.
 */
export const resetTwoFactor = (userId: string, reason: string) =>
  api.post<{ data: ResetTwoFactorResult }>(
    `/admin/v1/users/${userId}/account/two-factor/reset`,
    { reason },
  );

/**
 * This user's referral cashback from both sides: the reward they earn as
 * someone's referred friend, and one row per friend they invited.
 */
export const getUserReferrals = (userId: string) =>
  api.get<{ data: AdminUserReferrals }>(`/admin/v1/users/${userId}/referrals`);

/**
 * Put a referred friend's reversed or expired reward back through the current
 * rules, reinstating it if it stands. Never pays out itself: a reinstated
 * reward is paid by the next payout sweep. The reason is required and lands on
 * the friend's audit trail with the admin's name, which the backend takes from
 * the Firebase token, never from here.
 */
export const reevaluateReferralReward = (
  referredUserId: string,
  reason: string,
) =>
  api.post<{ data: ReferralReevaluationResult }>(
    `/admin/v1/users/${referredUserId}/referral-reward/reevaluate`,
    { reason },
  );

// --- Referral v4 + card credit ---------------------------------------------

/**
 * The payload of a response, whether or not the endpoint wraps it in
 * `{ data }`. The user endpoints here do and the analytics ones don't, and the
 * v4 endpoints were specified bare; reading both keeps the screens working
 * whichever way they ship. Only a body that is *exactly* `{ data: … }` is
 * unwrapped, so a payload with its own `data` field is left alone.
 */
export function unwrapData<T>(body: unknown): T {
  if (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "data" in body &&
    Object.keys(body).length === 1
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * What the signed-in admin may do with referral v4: edit its config, grant
 * and remove card credit, and decide the review queue. Read quietly — every
 * screen that asks shows its own state when it fails.
 */
export const getReferralV4Access = async () =>
  unwrapData<ReferralV4Access>(
    (
      await api.get("/admin/v1/referral-v4/access", {
        quietErrors: true,
      })
    ).data,
  );

/** This user's card credit: balance, lifetime totals and the full ledger. */
export const getUserCardCredit = async (userId: string) =>
  unwrapData<AdminCardCredit>(
    (
      await api.get(`/admin/v1/users/${userId}/card-credit`, {
        quietErrors: true,
      })
    ).data,
  );

/**
 * Give this user card credit (0 < amount ≤ 500). The reason is required and
 * lands on the ledger entry and the audit trail with the admin's name, which
 * the backend takes from the Firebase token.
 */
export const grantUserCardCredit = async (
  userId: string,
  body: CardCreditAdjustment,
) =>
  unwrapData<AdminCardCredit>(
    (await api.post(`/admin/v1/users/${userId}/card-credit/grant`, body)).data,
  );

/** Take card credit back, up to what is available (409 otherwise). */
export const removeUserCardCredit = async (
  userId: string,
  body: CardCreditAdjustment,
) =>
  unwrapData<AdminCardCredit>(
    (await api.post(`/admin/v1/users/${userId}/card-credit/remove`, body))
      .data,
  );

/**
 * Referral v4 from both sides: this user as a referrer (bonus limit, totals,
 * every friend with their rewards) and their own invite as a friend.
 */
export const getUserReferralsV4 = async (userId: string) =>
  unwrapData<AdminUserReferralsV4>(
    (
      await api.get(`/admin/v1/users/${userId}/referrals-v4`, {
        quietErrors: true,
      })
    ).data,
  );

/**
 * Cancel a v4 reward that has not been credited yet (on hold, over the bonus
 * limit, or under review). The reason is required.
 */
export const cancelReferralV4Reward = async (rewardId: string, reason: string) =>
  unwrapData<AdminReferralV4Reward>(
    (
      await api.post(
        `/admin/v1/referral-v4/rewards/${encodeURIComponent(rewardId)}/cancel`,
        { reason },
      )
    ).data,
  );

/**
 * Write off an open referral debt by hand: it stops being recovered from the
 * user's future bonuses and spend share. The note is optional; the backend
 * records the write-off on the audit trail with the admin's name.
 */
export const writeOffReferralV4Debt = async (debtId: string, note?: string) =>
  unwrapData<AdminReferralV4Debt>(
    (
      await api.post(
        `/admin/v1/referral-v4/debts/${encodeURIComponent(debtId)}/write-off`,
        note ? { note } : {},
      )
    ).data,
  );

/**
 * The rewards config, read quietly — for screens that only need a few of its
 * values (the referral v4 schedule and limits) and show their own fallback
 * when it can't be read. The config pages load it through `useConfigEditor`.
 */
export const getRewardsConfigQuietly = async () =>
  (
    await api.get<FullRewardsConfig>("/admin/v1/rewards-config", {
      quietErrors: true,
    })
  ).data;

/** Rewards held for review — v4 and today's stuck legacy ones — by referrer. */
export const getReferralReviewQueue = async () =>
  unwrapData<ReferralReviewQueue>(
    (
      await api.get("/admin/v1/referral-v4/review", {
        quietErrors: true,
      })
    ).data,
  );

/** Approve or reject a set of review items; reports each one's outcome. */
export const decideReferralReview = async (
  body: ReferralReviewDecisionRequest,
) =>
  unwrapData<ReferralReviewDecisionResult>(
    (await api.post("/admin/v1/referral-v4/review", body)).data,
  );

/** Every referral boost, past, live and scheduled. */
export const getReferralBoosts = async () =>
  unwrapData<ReferralBoostAdmin[]>(
    (
      await api.get("/admin/v1/referral-boosts", {
        quietErrors: true,
      })
    ).data,
  );

export const createReferralBoost = async (body: ReferralBoostInput) =>
  unwrapData<ReferralBoostAdmin>(
    (await api.post("/admin/v1/referral-boosts", body)).data,
  );

export const updateReferralBoost = async (
  id: string,
  body: Partial<ReferralBoostInput>,
) =>
  unwrapData<ReferralBoostAdmin>(
    (
      await api.patch(
        `/admin/v1/referral-boosts/${encodeURIComponent(id)}`,
        body,
      )
    ).data,
  );

export const deleteReferralBoost = (id: string) =>
  api.delete(`/admin/v1/referral-boosts/${encodeURIComponent(id)}`);

/** Card credit and spend-share totals, the next payout and a weekly series. */
export const getReferralV4Analytics = async () =>
  unwrapData<ReferralV4Analytics>(
    (
      await api.get("/admin/v1/analytics/rewards/referrals-v4", {
        quietErrors: true,
      })
    ).data,
  );

// --- Config → Internal team ------------------------------------------------

/**
 * The internal team — Solid staff and testers — active members first, then the
 * ones an admin removed, with whether the Wirex EUR account is staged to the
 * team in this environment.
 */
export const getInternalTeam = () =>
  api.get<{ data: InternalTeamRoster }>("/admin/v1/internal-team");

/**
 * Put a user on the internal team. `user` is whatever the admin has to hand —
 * a username, an email or a user id — and the backend resolves it. Refused
 * with a 404 when no account matches and a 409 when they are already an
 * active member. The admin identity comes from the Firebase token server-side.
 */
export const addInternalTeamMember = (user: string, note?: string) =>
  api.post<{ data: InternalTeamMember }>("/admin/v1/internal-team", {
    user,
    ...(note ? { note } : {}),
  });

/**
 * Take a member off the internal team. Soft: the row stays, marked removed, so
 * it can be restored and the reason is still on the page. The reason is
 * required and lands on the user's audit trail with the admin's name.
 */
export const removeInternalTeamMember = (userId: string, reason: string) =>
  api.post<{ data: InternalTeamMember }>(
    `/admin/v1/internal-team/${userId}/remove`,
    { reason },
  );

/**
 * Give an internal team member a feature — the Wirex EUR account, the Credit &
 * Smart spend modes, the EUR vault. Assigning one they already have is a
 * no-op. Audited on the member's profile.
 */
export const assignInternalTeamFeature = (
  userId: string,
  feature: InternalTeamFeatureKey
) =>
  api.post<{ data: InternalTeamMember }>(
    `/admin/v1/internal-team/${userId}/features/${feature}`
  );

/** Take a feature off an internal team member. They stay on the team. */
export const removeInternalTeamFeature = (
  userId: string,
  feature: InternalTeamFeatureKey
) =>
  api.delete<{ data: InternalTeamMember }>(
    `/admin/v1/internal-team/${userId}/features/${feature}`
  );

/** Put a removed member back on the internal team. */
export const restoreInternalTeamMember = (userId: string, note?: string) =>
  api.post<{ data: InternalTeamMember }>(
    `/admin/v1/internal-team/${userId}/restore`,
    note ? { note } : {},
  );

// --- Rewards / cohorts -----------------------------------------------------

export const getTierRecipients = (tier: number) =>
  api.get(`/admin/v1/points/tier-recipients`, { params: { tier } });

export const sendTierEmail = (tier: number, templateId: number) =>
  api.post(`/admin/v1/points/send-tier-email`, { tier, templateId });

export const getLatestCohortSnapshots = () =>
  api.get("/admin/v1/cohort-snapshots/latest");

export const getCohortEmails = (cohortId: string) =>
  api.get(`/admin/v1/cohort-snapshots/${cohortId}/emails`);

export const triggerCohortSnapshots = () =>
  api.post("/admin/v1/cohort-snapshots/trigger");

export default api;
