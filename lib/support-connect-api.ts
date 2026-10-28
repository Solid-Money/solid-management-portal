import api from "@/lib/api";

/**
 * The Claude connector's consent step. Claude sends the agent's browser to
 * admins-service, which forwards the OAuth request here; these calls check
 * it and record the agent's answer, with the agent's own portal session.
 */
const base = "/admin/v1/support/oauth";

/** The OAuth request parameters, passed through as they arrived. */
export type ConnectRequest = Record<string, string>;

export interface ConnectDescription {
  clientName: string;
  redirectHost: string;
  email: string;
}

export const describeConnectRequest = async (request: ConnectRequest) =>
  (
    await api.post<ConnectDescription>(`${base}/describe`, request, {
      quietErrors: true,
    })
  ).data;

export const decideConnectRequest = async (
  request: ConnectRequest,
  allow: boolean,
) =>
  (
    await api.post<{ redirectTo: string }>(`${base}/decide`, {
      ...request,
      allow,
    })
  ).data;
