import api from "@/lib/api";
import type {
  TaskBoards,
  TaskPartners,
  TaskCreateInput,
  TaskDetail,
  TaskFeedPage,
  TaskNotifications,
  TaskListFilters,
  TaskListPage,
  TaskPatchInput,
  TaskPerson,
  TaskReaction,
  TaskUpdate,
  TaskUpload,
  TaskBodyInput,
} from "@/types/tasks";

/**
 * Admin Tasks (`/admin/v1/tasks/*`). admins-service checks the Firebase
 * token, then proxies to flash-support-service; the admin acting is always
 * the signed-in one.
 */
const base = "/admin/v1/tasks";

export const getTaskPeople = async () =>
  (await api.get<TaskPerson[]>(`${base}/people`)).data;

export const getTasks = async (filters: TaskListFilters, page = 0) =>
  (
    await api.get<TaskListPage>(base, {
      params: {
        view: filters.view,
        ...(filters.owner ? { owner: filters.owner } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.label ? { label: filters.label } : {}),
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.board ? { board: filters.board } : {}),
        ...(page ? { page } : {}),
      },
    })
  ).data;

/** Polled for the nav badge: a failure just leaves the badge off. */
export const getTaskCounts = async () =>
  (
    await api.get<TaskListPage>(base, {
      params: { view: "mentions" },
      quietErrors: true,
    })
  ).data.counts;

// ---- Partners ----------------------------------------------------------------

/** Escalated support cases, by the partner (or team) they wait on. */
export const getTaskPartners = async () =>
  // Polled, and the tab shows its own error with a retry: no toast each minute.
  (await api.get<TaskPartners>(`${base}/partners`, { quietErrors: true })).data;

/** The partner's ticket and the follow-up date: not an escalation again. */
export const updateEscalation = async (
  caseId: string,
  input: { externalRef?: string | null; followUpAt?: string },
) => (await api.patch<unknown>(`/admin/v1/support/cases/${encodeURIComponent(caseId)}/escalation`, input)).data;

// ---- Boards ------------------------------------------------------------------

export const getTaskBoards = async () =>
  (await api.get<TaskBoards>(`${base}/boards`)).data;

export const createTaskBoard = async (name: string) =>
  (await api.post<TaskBoards>(`${base}/boards`, { name })).data;

export const renameTaskBoard = async (key: string, name: string) =>
  (await api.patch<TaskBoards>(`${base}/boards/${encodeURIComponent(key)}`, { name })).data;

/** Its tasks stay, on no board. */
export const deleteTaskBoard = async (key: string) =>
  (await api.delete<TaskBoards>(`${base}/boards/${encodeURIComponent(key)}`)).data;

export const getTask = async (id: string) =>
  (await api.get<TaskDetail>(`${base}/${id}`)).data;

export const createTask = async (input: TaskCreateInput) =>
  (await api.post<TaskDetail>(base, input)).data;

export const patchTask = async (id: string, input: TaskPatchInput) =>
  (await api.patch<TaskDetail>(`${base}/${id}`, input)).data;

export const followTask = async (id: string, follow: boolean) =>
  (await api.post<{ following: boolean }>(`${base}/${id}/follow`, { follow })).data;

export const postTaskUpdate = async (
  id: string,
  input: TaskBodyInput & { parentId?: string },
) => (await api.post<TaskUpdate>(`${base}/${id}/updates`, input)).data;

export const editTaskUpdate = async (
  id: string,
  updateId: string,
  input: { body: string; mentions?: string[] },
) => (await api.patch<TaskUpdate>(`${base}/${id}/updates/${updateId}`, input)).data;

export const deleteTaskUpdate = async (id: string, updateId: string) =>
  (await api.delete<{ deleted: true }>(`${base}/${id}/updates/${updateId}`)).data;

export const reactToTaskUpdate = async (id: string, updateId: string, emoji: TaskReaction) =>
  (await api.post<TaskUpdate>(`${base}/${id}/updates/${updateId}/reactions`, { emoji })).data;

export const addChecklistItem = async (
  id: string,
  input: { text: string; ownerEmail?: string },
) => (await api.post<TaskDetail>(`${base}/${id}/checklist`, input)).data;

export const patchChecklistItem = async (
  id: string,
  itemId: string,
  input: { text?: string; ownerEmail?: string | null; done?: boolean },
) => (await api.patch<TaskDetail>(`${base}/${id}/checklist/${itemId}`, input)).data;

export const deleteChecklistItem = async (id: string, itemId: string) =>
  (await api.delete<TaskDetail>(`${base}/${id}/checklist/${itemId}`)).data;

/** A pasted, dropped or picked image (or PDF), ready to attach to an update. */
export const uploadTaskFile = async (file: File) => {
  const form = new FormData();
  form.append("file", file, file.name || "image.png");
  return (await api.post<TaskUpload>(`${base}/uploads`, form)).data;
};

// ---- The bell ------------------------------------------------------------

/** Polled for the bell: a failure just leaves it quiet. */
export const getTaskNotifications = async () =>
  (await api.get<TaskNotifications>(`${base}/notifications`, { quietErrors: true })).data;

export const markTaskNotificationsRead = async (input: { ids?: string[]; all?: boolean }) =>
  (await api.post<{ unread: number }>(`${base}/notifications/read`, input)).data;

// ---- Team feed -------------------------------------------------------------

export const getTaskFeed = async (before?: string) =>
  (await api.get<TaskFeedPage>(`${base}/feed`, { params: before ? { before } : {} })).data;

export const postToFeed = async (input: TaskBodyInput & { parentId?: string }) =>
  (await api.post<TaskUpdate>(`${base}/feed`, input)).data;

export const editFeedPost = async (postId: string, input: { body: string; mentions?: string[] }) =>
  (await api.patch<TaskUpdate>(`${base}/feed/${postId}`, input)).data;

export const deleteFeedPost = async (postId: string) =>
  (await api.delete<{ deleted: true }>(`${base}/feed/${postId}`)).data;

export const reactToFeedPost = async (postId: string, emoji: TaskReaction) =>
  (await api.post<TaskUpdate>(`${base}/feed/${postId}/reactions`, { emoji })).data;
