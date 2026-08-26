/**
 * Links into the Temporal dashboard.
 *
 * A deposit that is stuck explains itself in its workflow's event history, so
 * the fastest path from "this deposit is stuck" to an answer is a link
 * straight to it. `NEXT_PUBLIC_TEMPORAL_UI_BASE_URL` defaults to Temporal
 * Cloud; self-hosted deployments point it at their own UI.
 */
const TEMPORAL_UI_BASE_URL = (
  process.env.NEXT_PUBLIC_TEMPORAL_UI_BASE_URL || "https://cloud.temporal.io"
).replace(/\/$/, "");

/**
 * Temporal Cloud namespaces are qualified with the account id, e.g.
 * `solid-backend-prod.s9x48`. Without one there is nothing to link to, so the
 * UI falls back to showing the workflow id as plain text.
 */
const TEMPORAL_NAMESPACE = process.env.NEXT_PUBLIC_TEMPORAL_NAMESPACE?.trim();

/**
 * Link to a workflow in the Temporal dashboard, or null when no namespace is
 * configured — a link into a namespace that doesn't exist is worse than none.
 *
 * Deliberately omits the run id: an execution's run id is not stored anywhere
 * we can read, and Temporal resolves this route to the workflow's latest run,
 * which is the one support wants in every case that matters.
 */
export function temporalWorkflowUrl(workflowId?: string | null): string | null {
  if (!workflowId || !TEMPORAL_NAMESPACE) return null;
  return `${TEMPORAL_UI_BASE_URL}/namespaces/${encodeURIComponent(
    TEMPORAL_NAMESPACE
  )}/workflows/${encodeURIComponent(workflowId)}`;
}
