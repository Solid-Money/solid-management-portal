import api from "@/lib/api";
import type {
  TaskCreateInput,
  TaskDetail,
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
