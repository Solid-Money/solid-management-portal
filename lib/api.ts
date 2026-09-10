import axios from "axios";
import { auth } from "./firebase";
import { toast } from "sonner";
import {
  IssueTierTrialRequest,
  IssueTierTrialResult,
  SetTransactionCashbackPercentageResult,
  SetUserCashbackPercentageResult,
  TierTrial,
  TierTrialView,
} from "@/types";

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

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error(
        "[API] Unauthorized request - token may be invalid or expired",
      );
      toast.error("Session expired. Please sign in again.");
    } else {
      const message =
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred";
      toast.error(message);
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

export const getCardFreezeHistory = (userId: string) =>
  api.get(`/admin/v1/users/${userId}/card/freeze-history`);

/**
 * Freeze or unfreeze a user's card. The admin identity is taken from the
 * Firebase token server-side — never sent from here — so the audit row and the
 * Slack message name whoever is actually signed in.
 */
export const setUserCardFreeze = (
  userId: string,
  freeze: boolean,
  reason?: string
) =>
  api.post(`/admin/v1/users/${userId}/card/freeze`, {
    freeze,
    ...(reason ? { reason } : {}),
  });

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
  request: IssueTierTrialRequest
) =>
  api.post<{ data: IssueTierTrialResult }>(
    `/admin/v1/users/${userId}/tier-trial`,
    request
  );

/**
 * Take a tier trial back — one the user has not opened, or one already running.
 * Either way they return to the tier their points and FUSE balance earn them.
 */
export const revokeUserTierTrial = (
  userId: string,
  options: { trialId?: string; reason?: string } = {}
) =>
  api.post<{ data: TierTrial }>(
    `/admin/v1/users/${userId}/tier-trial/revoke`,
    options
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
  reason?: string
) =>
  api.post<{ data: SetUserCashbackPercentageResult }>(
    `/admin/v1/users/${userId}/cashback-percentage`,
    { percentage, ...(reason ? { reason } : {}) }
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
  reason?: string
) =>
  api.post<SetTransactionCashbackPercentageResult>(
    `/admin/v1/card-transactions/${encodeURIComponent(
      transactionId
    )}/cashback-percentage`,
    { percentage, ...(reason ? { reason } : {}) }
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
