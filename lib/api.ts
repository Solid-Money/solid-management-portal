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
  CardRelinkContext,
  IssueCardRequest,
  IssueCardResult,
  RelinkCardRequest,
  RelinkCardResult,
  RainRtfStatus,
  IssueTierTrialRequest,
  IssueTierTrialResult,
  InternalTeamFeatureKey,
  InternalTeamMember,
  InternalTeamRoster,
  ListedToken,
  ListedTokenChanges,
  NewListedToken,
  TokenCatalogue,
  TokenLookup,
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
  BulkReevaluateFailedCashbackResult,
  StuckCashbackList,
  WithholdCashbackResult,
  TrialCashbackCorrectionPlan,
  ApplyTrialCashbackTermsResult,
  TierTrial,
  TierLockReevaluationPreview,
  TierLockReevaluationResult,
  TierLockThresholds,
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
  CountryAccessList,
  CountryAccessListKey,
  CountryAccessOverview,
  CreatedDiditQuestionnaire,
  DiditLinkCheck,
  UpdateCountryAccessListRequest,
} from "@/types/country-access";
import {
  CollectSettlementRequest,
  CollectSettlementResult,
  UncollectedSettlements,
} from "@/types/cash-collect";
import type {
  BulkRevokeResult,
  BulkSessionPreview,
  PasskeyCleanupPreview,
  PasskeyCleanupResult,
  SecurityCloseResult,
} from "@/types/bulk-session";

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
 * What the re-link dialog opens with: every card the issuer holds for this
 * cardholder, which can be attached back to the account, and why the rest
 * cannot.
 *
 * Read when the dialog opens rather than with the card panel — it calls the
 * issuer for the live card list.
 */
export const getCardRelinkContext = (userId: string) =>
  api.get<{ data: CardRelinkContext }>(
    `/admin/v1/users/${userId}/card/relink-context`,
  );

/**
 * Attach a card the issuer still holds back to this user's account — for an
 * account that was closed and reopened, which loses its card link. Nothing is
 * issued or cancelled. The admin identity comes from the Firebase token
 * server-side, never from here.
 */
export const relinkUserCard = (userId: string, request: RelinkCardRequest) =>
  api.post<{ data: RelinkCardResult }>(
    `/admin/v1/users/${userId}/card/relink`,
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
export const reevaluateTierLock = (
  userId: string,
  reason?: string,
  /**
   * The prices to pin, only when the preview says `needsThresholds`: the lock
   * has no record and the price on the day it was opened is not on record.
   */
  thresholds?: TierLockThresholds,
) =>
  api.post<{ data: TierLockReevaluationResult }>(
    `/admin/v1/users/${userId}/tier-lock/reevaluate`,
    { reason: reason || undefined, ...(thresholds ?? {}) },
  );

/**
 * What re-evaluating this user's lock would do, without doing it — chiefly
 * whether the price it was bought at is on record or has to be entered.
 *
 * Quiet: the dialog still works without it (a backend from before it existed
 * has no such route), so a failure here should not toast.
 */
export const getTierLockReevaluationPreview = (userId: string) =>
  api.get<{ data: TierLockReevaluationPreview }>(
    `/admin/v1/users/${userId}/tier-lock/reevaluate`,
    { quietErrors: true },
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
 * Every PermanentlyFailed cashback row across all cardholders, with who it
 * belongs to, what it is owed and why it gave up. Backs Config → Bulk.
 */
export const getStuckCashback = () =>
  api.get<{ data: StuckCashbackList }>("/admin/v1/cashback/permanently-failed");

/**
 * Put the chosen PermanentlyFailed rows back in the retry queue, across any
 * number of users. The retry cron pays them through the normal payout path;
 * rows already re-sent or paid, and rows whose user has no Safe, come back as
 * skipped. Each user's audit trail records it under the admin's name.
 */
export const bulkReevaluateFailedCashback = (
  cashbackIds: string[],
  reason?: string,
) =>
  api.post<{ data: BulkReevaluateFailedCashbackResult }>(
    "/admin/v1/cashback/permanently-failed/reevaluate",
    { cashbackIds, reason: reason || undefined },
  );

/**
 * What putting this user's tier-trial cashback terms back on the purchases made
 * during their trials would change. Read-only.
 */
export const getTrialCashbackTerms = (userId: string) =>
  api.get<{ data: TrialCashbackCorrectionPlan }>(
    `/admin/v1/users/${encodeURIComponent(userId)}/cashback/trial-terms`,
  );

/**
 * Apply the trial-terms corrections the admin approved. Nothing is sent from
 * here: the hourly escrow run pays re-queued rows and top-ups through the
 * normal payout path. Rows changed since the preview come back as skipped.
 */
export const applyTrialCashbackTerms = (
  userId: string,
  cashbackIds: string[],
  reason?: string,
) =>
  api.post<{ data: ApplyTrialCashbackTermsResult }>(
    `/admin/v1/users/${encodeURIComponent(userId)}/cashback/trial-terms`,
    { cashbackIds, reason: reason || undefined },
  );

/**
 * Withhold this user's unpaid cashback: every Escrowed, Pending or Failed row
 * is marked Ineligible so no cron pays it. For accounts found abusing rewards;
 * rows already paid are left alone. The reason is required and goes on the
 * audit trail with the admin's name from the Firebase token.
 */
export const withholdUserCashback = (userId: string, reason: string) =>
  api.post<{ data: WithholdCashbackResult }>(
    `/admin/v1/users/${encodeURIComponent(userId)}/cashback/withhold`,
    { reason },
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
 * Narrow by design: it clears our record of the decision — including a failed
 * hand-off to the card issuer and any deposit hold on it — and nothing else: no
 * issuer consumer is deleted, no card is touched, nothing is sent to the
 * issuer, and the provider's own decision is not overturned. The reason is required; it is written to the
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

// --- Security: bulk session revoke -----------------------------------------

/**
 * Preview a bulk session revoke: for each account id, who it is, its balance,
 * and how many live sessions a revoke would end. Read-only — nothing is signed
 * out by this call.
 */
export const bulkSessionPreview = (userIds: string[]) =>
  api.post<{ data: BulkSessionPreview }>("/admin/v1/security/sessions/preview", {
    userIds,
  });

/**
 * Revoke every login session for each listed account: their refresh tokens are
 * invalidated, so each session ends when its access token expires and the
 * account must sign in again. Not selective — the real owner is signed out too —
 * so it is an incident-response action. The reason is written to every account's
 * audit row; the admin identity comes from the Firebase token server-side.
 */
export const bulkRevokeSessions = (userIds: string[], reason: string) =>
  api.post<{ data: BulkRevokeResult }>("/admin/v1/security/sessions/revoke", {
    userIds,
    reason,
  });

// --- Security: security-close ----------------------------------------------

/**
 * Close one account for security and unlink its Safe: sessions, TOTP and the
 * spend config removed, the row closed. Per-account — the Revoke page closes a
 * list one id at a time. Refused with a 409 for an account that still has a
 * card. The reason is written to the audit trail; the admin identity comes
 * from the Firebase token server-side.
 */
export const securityCloseAccount = (userId: string, reason: string) =>
  api.post<{ data: SecurityCloseResult }>(
    `/admin/v1/users/${userId}/account/security-close`,
    { reason },
  );

// --- Security: fake passkey removal ----------------------------------------

/**
 * Count how far an injected passkey credential has spread before removing it:
 * accounts carrying it, passkeydetails rows, and how many would be left with no
 * credential (and so left untouched). Read-only.
 */
export const fakePasskeyPreview = (credentialId: string) =>
  api.post<{ data: PasskeyCleanupPreview }>(
    "/admin/v1/users/passkey-cleanup/preview",
    { credentialId },
  );

/**
 * Strip an injected passkey credential from every account that keeps a real
 * one, and delete its passkeydetails rows. Accounts whose only credential is
 * the fake are left untouched and reported. The reason is written to the audit
 * trail; the admin identity comes from the Firebase token server-side.
 */
export const fakePasskeyCleanup = (credentialId: string, reason: string) =>
  api.post<{ data: PasskeyCleanupResult }>(
    "/admin/v1/users/passkey-cleanup/execute",
    { credentialId, reason },
  );

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

// --- Config → Tokens --------------------------------------------------------

/**
 * The `swaptokens` list: every row, the chains a token can be added on, and
 * the deposit tokens the list has no row for yet.
 */
export const getTokenCatalogue = () =>
  api.get<{ data: TokenCatalogue }>("/admin/v1/tokens");

/**
 * The row a contract already has, or a new one read from the chain: name,
 * symbol and decimals from the contract, with the logo, price id and
 * cross-chain id the list already uses for that symbol. 400 when nothing
 * answers as an ERC-20 at that address.
 */
export const lookupToken = (chainId: number, address: string) =>
  api.get<{ data: TokenLookup }>("/admin/v1/tokens/lookup", {
    params: { chainId, address },
  });

/** Add a token. 409 when it is already listed, in any address case. */
export const createListedToken = (token: NewListedToken) =>
  api.post<{ data: ListedToken }>("/admin/v1/tokens", token);

/** Change a row. Chain, address and decimals are the token's own and stay. */
export const updateListedToken = (id: string, changes: ListedTokenChanges) =>
  api.patch<{ data: ListedToken }>(`/admin/v1/tokens/${id}`, changes);

/** Delete a row outright. Turning it off (`isActive: false`) keeps it. */
export const deleteListedToken = (id: string) =>
  api.delete<{ data: { id: string } }>(`/admin/v1/tokens/${id}`);

/**
 * Add deposit tokens the list is missing, by `chainId:address`. The backend
 * builds each row from its own deposit tables; keys no longer missing come
 * back as skipped.
 */
export const addMissingDepositTokens = (keys: string[]) =>
  api.post<{ data: { added: ListedToken[]; skipped: string[] } }>(
    "/admin/v1/tokens/deposit-tokens",
    { keys },
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
 * Smart spend modes, the new deposit tokens. Assigning one they already have is
 * a no-op. Audited on the member's profile.
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

// --- Config → Countries ----------------------------------------------------

/**
 * Every country list (Wirex card, Rain card, Rain virtual account, TransFi),
 * the country catalog with display names, and the read-only code lists.
 */
export const getCountryAccess = () =>
  api.get<{ data: CountryAccessOverview }>("/admin/v1/country-access");

/**
 * Replace one list. Live for new sign-ups at once; added countries stay
 * pending until the provider side is confirmed. Refused with a 409 when
 * someone else saved the list after `expectedUpdatedAt`.
 */
export const updateCountryAccessList = (
  list: CountryAccessListKey,
  body: UpdateCountryAccessListRequest,
) =>
  api.put<{ data: CountryAccessList }>(
    `/admin/v1/country-access/${list}`,
    body,
  );

/** Generate a Didit questionnaire from a Rain list as it is stored now. */
export const createCountryAccessDiditQuestionnaire = (
  list: CountryAccessListKey,
) =>
  api.post<{ data: CreatedDiditQuestionnaire }>(
    `/admin/v1/country-access/${list}/didit-questionnaire`,
  );

/** Ask Didit whether the workflow runs the generated questionnaire yet. */
export const verifyCountryAccessDiditLink = (list: CountryAccessListKey) =>
  api.post<{ data: DiditLinkCheck }>(
    `/admin/v1/country-access/${list}/didit-link/verify`,
  );

/** Record that the provider side (Didit or Sumsub) now matches the list. */
export const confirmCountryAccessProvider = (
  list: CountryAccessListKey,
  note?: string,
) =>
  api.post<{ data: CountryAccessList }>(
    `/admin/v1/country-access/${list}/provider-confirmation`,
    note ? { note } : {},
  );

/** Rewrite the card and VA lists from the code constants. */
export const resetCountryAccessToDefaults = () =>
  api.post<{ data: CountryAccessOverview }>(
    "/admin/v1/country-access/reset-defaults",
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
