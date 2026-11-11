import api from "@/lib/api";
import type {
  PushCampaignDestinations,
  PushCampaignPreview,
  PushCampaignSummary,
  PushCampaignTestInput,
  PushCampaignTestResult,
  SendPushCampaignInput,
} from "@/types/push-campaigns";

/**
 * Growth → Push notifications (`/admin/v1/push-campaigns`). admins-service
 * checks the Firebase token and forwards it; accounts-service verifies it again
 * and names the signed-in admin on the campaign and its audit rows.
 */
const base = "/admin/v1/push-campaigns";

/** Where a push can open, the active What's New, limits, and `canSend`. */
export const getPushCampaignDestinations = async () =>
  (await api.get<{ data: PushCampaignDestinations }>(`${base}/destinations`))
    .data.data;

/** The most recent campaigns, newest first. */
export const getPushCampaigns = async () =>
  (await api.get<{ data: PushCampaignSummary[] }>(base)).data.data;

/** Who of an uploaded list a campaign would reach. Read-only. */
export const previewPushCampaignAudience = async (userIds: string[]) =>
  (
    await api.post<{ data: PushCampaignPreview }>(`${base}/preview`, {
      userIds,
    })
  ).data.data;

/** Send every variant to a few named users, labelled as a test. */
export const sendPushCampaignTest = async (input: PushCampaignTestInput) =>
  (await api.post<{ data: PushCampaignTestResult }>(`${base}/test`, input))
    .data.data;

/**
 * Assign the audience to its groups and send. Refused with a 409 when a
 * campaign of the same name was already sent, so a double submit never pushes
 * twice.
 */
export const sendPushCampaign = async (input: SendPushCampaignInput) =>
  (await api.post<{ data: PushCampaignSummary }>(base, input)).data.data;
