import api from "@/lib/api";
import type {
  SupportAgentCase,
  SupportAgentMessage,
  SupportAuditEntry,
  SupportConversationView,
  SupportMacro,
  SupportMe,
  SupportQueueCounts,
  SupportQueuePage,
  SupportQueueView,
  SupportReplyInput,
  SupportReport,
  SupportSettings,
  SupportSettingsHistoryEntry,
  SupportStartInput,
  SupportTranslationPreview,
} from "@/types/support";

/**
 * The support inbox (`/admin/v1/support/*`). admins-service checks the
 * Firebase token (every portal admin is an agent), then proxies to
 * flash-support-service; the agent is always the signed-in admin.
 */
const base = "/admin/v1/support";

export const getSupportMe = async () =>
  (await api.get<SupportMe>(`${base}/me`)).data;

/** Polled for the nav badge: a failure just leaves the badge off. */
export const getSupportCounts = async () =>
  (await api.get<SupportQueueCounts>(`${base}/counts`, { quietErrors: true })).data;

export const getSupportQueue = async (query: {
  view: SupportQueueView;
  q?: string;
  page?: number;
}) =>
  (
    await api.get<SupportQueuePage>(`${base}/queue`, {
      params: {
        view: query.view,
        ...(query.q ? { q: query.q } : {}),
        ...(query.page ? { page: query.page } : {}),
      },
    })
  ).data;

export const getSupportConversation = async (id: string) =>
  (await api.get<SupportConversationView>(`${base}/conversations/${id}`)).data;

export const getSupportOlderMessages = async (id: string, beforeSeq: number) =>
  (
    await api.get<{ messages: SupportAgentMessage[]; hasOlder: boolean }>(
      `${base}/conversations/${id}/messages`,
      { params: { beforeSeq } },
    )
  ).data;

export const sendSupportReply = async (id: string, input: SupportReplyInput) =>
  (
    await api.post<{ message: SupportAgentMessage; case: SupportAgentCase | null }>(
      `${base}/conversations/${id}/messages`,
      input,
    )
  ).data;

export const previewSupportTranslation = async (id: string, body: string) =>
  (
    await api.post<SupportTranslationPreview>(
      `${base}/conversations/${id}/translate-preview`,
      { body },
    )
  ).data;

export const markSupportRead = async (id: string, seq: number) =>
  (await api.post<{ lastReadSeqAgent: number }>(`${base}/conversations/${id}/read`, { seq })).data;

export const redactSupportMessage = async (
  messageId: string,
  input: { mode: "message" | "text"; text?: string; reason: string },
) =>
  (await api.post<SupportAgentMessage>(`${base}/messages/${messageId}/redact`, input)).data;

type CaseAction =
  | { action: "assign"; body: { assigneeEmail: string | null } }
  | { action: "snooze"; body: { until: string | null } }
  | {
      action: "escalate";
      body: { target: string; reason: string; externalRef?: string; followUpAt: string };
    }
  | {
      action: "complaint";
      body: { type: string; noticeReceivedAt?: string; reason?: string };
    }
  | { action: "intent"; body: { intent: string } }
  | { action: "resolve" }
  | { action: "reopen" }
  | { action: "draft/approve" }
  | { action: "draft/discard"; body: { reason?: string } }
  | { action: "hand-back-to-ai" };

export const runSupportCaseAction = async (caseId: string, input: CaseAction) =>
  (
    await api.post<SupportAgentCase>(
      `${base}/cases/${caseId}/${input.action}`,
      "body" in input ? input.body : {},
    )
  ).data;

/** The user page card shows its own message when this fails. */
/**
 * Write to a customer first. Opens their conversation if they never wrote,
 * or adds to the one they have; the reply is translated like any other.
 */
export const startSupportConversation = async (userId: string, input: SupportStartInput) =>
  (
    await api.post<{
      conversationId: string;
      message: SupportAgentMessage;
      case: SupportAgentCase | null;
    }>(`${base}/users/${userId}/messages`, input)
  ).data;

export const getSupportUserCases = async (userId: string) =>
  (
    await api.get<{ conversationId: string | null; cases: SupportAgentCase[] }>(
      `${base}/users/${userId}/cases`,
      { quietErrors: true },
    )
  ).data;

export const getSupportSettings = async () =>
  (
    await api.get<{ settings: SupportSettings; translationAvailable: boolean }>(
      `${base}/settings`,
    )
  ).data;

export const updateSupportSettings = async (
  patch: Partial<Omit<SupportSettings, "version" | "updatedBy" | "updatedAt">>,
) =>
  (
    await api.put<{ settings: SupportSettings; translationAvailable: boolean }>(
      `${base}/settings`,
      patch,
    )
  ).data;

export const getSupportSettingsHistory = async () =>
  (await api.get<SupportSettingsHistoryEntry[]>(`${base}/settings/history`)).data;

export const getSupportMacros = async () =>
  (await api.get<SupportMacro[]>(`${base}/macros`)).data;

export const saveSupportMacro = async (
  input: { title: string; body: string; shortcut?: string },
  id?: string,
) =>
  id
    ? (await api.put<SupportMacro>(`${base}/macros/${id}`, input)).data
    : (await api.post<SupportMacro>(`${base}/macros`, input)).data;

export const deleteSupportMacro = async (id: string) =>
  (await api.delete<{ deleted: true }>(`${base}/macros/${id}`)).data;

export const renderSupportMacro = async (id: string, conversationId: string) =>
  (await api.post<{ body: string }>(`${base}/macros/${id}/render`, { conversationId })).data;

export const getSupportAudit = async (query: { caseId?: string; conversationId?: string }) =>
  (
    await api.get<{ entries: SupportAuditEntry[]; hasMore: boolean }>(`${base}/audit`, {
      params: query,
    })
  ).data;

export const getSupportReport = async (from: string, to: string) =>
  (await api.get<SupportReport>(`${base}/reports`, { params: { from, to } })).data;

/** The complaint register as a file the browser saves. */
export async function downloadComplaintRegister(from: string, to: string): Promise<void> {
  const response = await api.get<Blob>(`${base}/reports/complaints.csv`, {
    params: { from, to },
    responseType: "blob",
  });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "complaint-register.csv";
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** A fresh id per reply, so a retried send is never stored twice. */
export function newAgentMessageId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `agent-${random}`;
}
