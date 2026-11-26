import api from "@/lib/api";
import type {
  PushCampaignAudienceFilters,
  PushCampaignDestinations,
  PushCampaignDetail,
  PushCampaignPreview,
  PushCampaignSummary,
  PushCampaignTestInput,
  PushCampaignTestResult,
  SchedulePushCampaignInput,
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

/** The scheduled campaigns, soonest first, then the most recent others. */
export const getPushCampaigns = async () =>
  (await api.get<{ data: PushCampaignSummary[] }>(base)).data.data;

/** One campaign, with a scheduled one's uploaded list. */
export const getPushCampaign = async (id: string) =>
  (await api.get<{ data: PushCampaignDetail }>(`${base}/${id}`)).data.data;

/** Who of an uploaded list a campaign would reach now, filters applied. Read-only. */
export const previewPushCampaignAudience = async (
  userIds: string[],
  filters?: PushCampaignAudienceFilters,
) =>
  (
    await api.post<{ data: PushCampaignPreview }>(`${base}/preview`, {
      userIds,
      ...(filters ? { filters } : {}),
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

/**
 * Store a campaign to go out at `sendAt`. Its audience is checked when it goes
 * out; the name is reserved now (409 when taken).
 */
export const schedulePushCampaign = async (input: SchedulePushCampaignInput) =>
  (await api.post<{ data: PushCampaignSummary }>(`${base}/schedule`, input))
    .data.data;

/** Replace a scheduled campaign; 409 once it has started going out. */
export const updateScheduledPushCampaign = async (
  id: string,
  input: SchedulePushCampaignInput,
) =>
  (await api.patch<{ data: PushCampaignSummary }>(`${base}/${id}`, input)).data
    .data;

/** Call a scheduled campaign off; 409 once it has started going out. */
export const cancelScheduledPushCampaign = async (id: string) =>
  (await api.post<{ data: PushCampaignSummary }>(`${base}/${id}/cancel`)).data
    .data;
