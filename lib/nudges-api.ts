import api from "@/lib/api";
import type {
  NudgeBoard,
  NudgeBrevoTemplateView,
  NudgeCreateRequest,
  NudgeDetail,
  NudgeMigrationApplyRequest,
  NudgeMigrationId,
  NudgeMigrationPlan,
  NudgeMigrationResult,
  NudgeMigrationView,
  NudgeRestoreVersionRequest,
  NudgeSettingsUpdateRequest,
  NudgeSettingsView,
  NudgeTestRequest,
  NudgeTestResult,
  NudgeUpdateRequest,
  NudgeVersionView,
  NudgeView,
} from "@/types/nudges";

/**
 * Growth → Automated nudges (`/admin/v1/nudges*`, flash-admins-service). The
 * admin's Firebase token is forwarded to accounts-service, which owns the
 * `nudges*` collections, verifies it again and names the admin on every
 * version and audit row.
 */
const base = "/admin/v1/nudges";

const nudgePath = (key: string) => `${base}/${encodeURIComponent(key)}`;

/** Every nudge, the global rules, the catalog and whether this admin may edit. */
export const getNudgeBoard = async () =>
  (await api.get<{ data: NudgeBoard }>(base)).data.data;

/** One nudge and its versions, newest first. */
export const getNudgeDetail = async (key: string) =>
  (await api.get<{ data: NudgeDetail }>(nudgePath(key))).data.data;

/**
 * Save changes to one nudge. Refused with a 409 when someone saved it since
 * `expectedVersion`, so an edit never overwrites one it did not see.
 */
export const updateNudge = async (key: string, input: NudgeUpdateRequest) =>
  (await api.patch<{ data: NudgeView }>(nudgePath(key), input)).data.data;

/** A new nudge built on an event, created as a draft. */
export const createNudge = async (input: NudgeCreateRequest) =>
  (await api.post<{ data: NudgeView }>(base, input)).data.data;

/** Put a nudge back the way it was at `version`, as a new version. */
export const restoreNudgeVersion = async (
  key: string,
  version: number,
  input: NudgeRestoreVersionRequest
) =>
  (
    await api.post<{ data: NudgeView }>(
      `${nudgePath(key)}/versions/${version}/restore`,
      input
    )
  ).data.data;

/** Send the nudge (or unsaved edits of it) to a few named users. */
export const sendNudgeTest = async (key: string, input: NudgeTestRequest) =>
  (await api.post<{ data: NudgeTestResult }>(`${nudgePath(key)}/test`, input))
    .data.data;

/** Save the global rules (marketing switch, cap, quiet hours, groups). */
export const updateNudgeSettings = async (input: NudgeSettingsUpdateRequest) =>
  (await api.patch<{ data: NudgeSettingsView }>("/admin/v1/nudge-settings", input))
    .data.data;

/** Every change to every nudge and to the rules, newest first. */
export const getNudgeHistory = async (limit = 100) =>
  (
    await api.get<{ data: NudgeVersionView[] }>("/admin/v1/nudge-history", {
      params: { limit },
    })
  ).data.data;

/** A Brevo template, read live: name, subject, active, params and HTML. */
export const getNudgeTemplate = async (id: number) =>
  (
    await api.get<{ data: NudgeBrevoTemplateView }>(
      `/admin/v1/nudge-templates/${id}`,
      { quietErrors: true }
    )
  ).data.data;

const migrationsBase = "/admin/v1/nudge-migrations";

/** The nudge migrations and whether each has been applied. */
export const getNudgeMigrations = async () =>
  (await api.get<{ data: NudgeMigrationView[] }>(migrationsBase)).data.data;

/** What a migration would change. Read-only. */
export const dryRunNudgeMigration = async (id: NudgeMigrationId) =>
  (
    await api.post<{ data: NudgeMigrationPlan }>(
      `${migrationsBase}/${id}/dry-run`,
      {}
    )
  ).data.data;

/**
 * Apply a migration exactly as dry-run planned it. Refused with a 409 when the
 * plan changed since (`planHash`), so nothing applies that was not previewed.
 */
export const applyNudgeMigration = async (
  id: NudgeMigrationId,
  input: NudgeMigrationApplyRequest
) =>
  (
    await api.post<{ data: NudgeMigrationResult }>(
      `${migrationsBase}/${id}/apply`,
      input
    )
  ).data.data;
