import axios from "axios";
import { auth } from "./firebase";
import { toast } from "sonner";

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
