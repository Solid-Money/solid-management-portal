/**
 * Admin Tasks' API shapes, as flash-support-service returns them through
 * admins-service (`/admin/v1/tasks/*`).
 * Backend: apps/flash-support-service/src/tasks in solid-backend
 * (libs/common/src/types/tasks.types.ts holds the same types).
 */

export const TASK_STATUSES = [
  "todo",
  "working",
  "waiting",
  "stuck",
  "review",
  "qa",
  "done",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_VIEWS = ["open", "mine", "mentions", "support", "radar", "done"] as const;
export type TaskListView = (typeof TASK_VIEWS)[number];

export type TaskSourceKind = "manual" | "support" | "radar" | "claude";
export type TaskVisibility = "everyone" | "restricted";
export type TaskLinkKind = "conversation" | "user" | "task" | "url";
export type TaskBot = "solid-ai" | "radar" | "claude";

export const TASK_REACTIONS = ["👍", "👀", "🎉", "✅", "❤️"] as const;
export type TaskReaction = (typeof TASK_REACTIONS)[number];

export interface TaskPerson {
  email: string;
  name: string | null;
}

export interface TaskAttachment {
  key: string;
  mime: string;
  size: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
  /** A five-minute signed link; refetch the task for a fresh one. */
  url: string | null;
}

export interface TaskLink {
  kind: TaskLinkKind;
  ref: string;
  label: string | null;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  ownerEmail: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
}

export interface TaskAuthor {
  email: string | null;
  name: string | null;
  bot: TaskBot | null;
}

export interface TaskActivity {
  field: "status" | "owner" | "priority" | "due" | "title" | "created" | "board";
  from: string | null;
  to: string | null;
}

export interface TaskUpdate {
  id: string;
  kind: "update" | "activity";
  parentId: string | null;
  author: TaskAuthor;
  body: string;
  mentions: string[];
  attachments: TaskAttachment[];
  activity: TaskActivity | null;
  reactions: Array<{ emoji: TaskReaction; emails: string[] }>;
  seenBy: string[];
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  replies: TaskUpdate[];
}

export interface TaskRow {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  ownerEmail: string | null;
  helperEmails: string[];
  dueDate: string | null;
  labels: string[];
  group: string | null;
  /** The board's key; null when on no board. */
  board: string | null;
  source: { kind: TaskSourceKind; label: string | null };
  createdBy: TaskAuthor;
  visibility: TaskVisibility;
  updateCount: number;
  hasNew: boolean;
  quietDays: number | null;
  lastUpdateAt: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface TaskDetail extends TaskRow {
  description: { body: string; mentions: string[]; attachments: TaskAttachment[] };
  checklist: TaskChecklistItem[];
  links: TaskLink[];
  followerEmails: string[];
  following: boolean;
  updates: TaskUpdate[];
}

export interface TaskListCounts {
  open: number;
  mine: number;
  mentions: number;
  support: number;
  radar: number;
  forYou: number;
}

export interface TaskListPage {
  view: TaskListView;
  rows: TaskRow[];
  counts: TaskListCounts;
  page: number;
  hasMore: boolean;
}

export interface TaskListFilters {
  view: TaskListView;
  owner?: string;
  priority?: TaskPriority;
  label?: string;
  q?: string;
  /** A board's key, or "none" for tasks on no board. Every board when absent. */
  board?: string;
}

export interface TaskBoard {
  key: string;
  name: string;
  /** Support or Radar: filled automatically, can't be deleted. */
  system: boolean;
  /** Open tasks on it. */
  open: number;
}

export interface TaskBoards {
  boards: TaskBoard[];
  /** Open tasks on every board and on none. */
  all: number;
  /** Open tasks on no board. */
  unsorted: number;
}

export interface TaskBodyInput {
  body: string;
  mentions?: string[];
  attachmentIds?: string[];
}

export interface TaskCreateInput {
  title: string;
  description?: TaskBodyInput;
  status?: TaskStatus;
  priority?: TaskPriority;
  ownerEmail?: string;
  helperEmails?: string[];
  dueDate?: string;
  labels?: string[];
  group?: string;
  board?: string;
  visibility?: TaskVisibility;
}

export interface TaskPatchInput {
  title?: string;
  description?: TaskBodyInput;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  ownerEmail?: string | null;
  helperEmails?: string[];
  dueDate?: string | null;
  labels?: string[];
  group?: string | null;
  board?: string | null;
  visibility?: TaskVisibility;
}

export interface TaskUpload {
  id: string;
  key: string;
  mime: string;
  size: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
  url: string | null;
}

export type TaskNotificationKind =
  | "mention"
  | "assigned"
  | "reply"
  | "update"
  | "status"
  | "nudge"
  | "feed_mention";

export interface TaskNotification {
  id: string;
  kind: TaskNotificationKind;
  /** Null for a Team feed mention. */
  taskId: string | null;
  taskNumber: number | null;
  taskTitle: string | null;
  actor: TaskAuthor;
  excerpt: string;
  updateId: string | null;
  createdAt: string;
  read: boolean;
}

export interface TaskNotifications {
  items: TaskNotification[];
  unread: number;
}

export interface TaskFeedPage {
  posts: TaskUpdate[];
  hasMore: boolean;
}
