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

/**
 * Support work is on the Support and Radar boards; product work is every
 * other board and no board.
 */
export const TASK_AREAS = ["product", "support", "marketing"] as const;
export type TaskArea = (typeof TASK_AREAS)[number];

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

/** `html` from the rich editor; `text` for plain text and what Solid AI and the radar write. */
export type TaskBodyFormat = "text" | "html";

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
  field:
    | "status"
    | "owner"
    | "priority"
    | "due"
    | "title"
    | "created"
    | "board"
    | "sprint"
    | "stage"
    | "channel"
    | "publish"
    | "campaign";
  from: string | null;
  to: string | null;
}

export interface TaskUpdate {
  id: string;
  kind: "update" | "activity";
  parentId: string | null;
  author: TaskAuthor;
  body: string;
  format: TaskBodyFormat;
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
  /** Its sprint's Monday (`YYYY-MM-DD`); null in the backlog. */
  sprint: string | null;
  /** Sprints that ended with it open, carrying it into the next. */
  carriedOver: number;
  source: { kind: TaskSourceKind; label: string | null };
  createdBy: TaskAuthor;
  visibility: TaskVisibility;
  updateCount: number;
  hasNew: boolean;
  quietDays: number | null;
  lastUpdateAt: string | null;
  /** The newest update a person wrote (not a bot); null when none has. Absent from older backends. */
  lastPersonUpdateAt?: string | null;
  /** Radar tasks: the radar alerts in it; else empty. Absent from older backends. */
  radarItemIds?: string[];
  createdAt: string;
  closedAt: string | null;
  /** On the Marketing board: the piece's channel, stage, brief…; else null. */
  marketing: TaskMarketing | null;
  /** The newest update written on it, on one line; null when none. Only on list, sprint and search rows. */
  lastUpdate?: TaskLastUpdate | null;
}

export interface TaskLastUpdate {
  author: TaskAuthor;
  /** Its words on one line, at most 160 characters. */
  text: string;
  at: string;
}

/** The Team tab: `sprint` = all work in progress, stuck, waiting or in review, plus this sprint's To do; `open` = every open task. */
export type TaskTeamScope = "sprint" | "open";

export interface TaskTeamCard {
  task: TaskRow;
  /** On this person's row as a helper, not the owner. */
  helping: boolean;
  /** Days without an update from a person while in progress, stuck, waiting or in review (3+); else null. */
  quietDays: number | null;
}

export interface TaskTeamColumns {
  working: TaskTeamCard[];
  blocked: TaskTeamCard[];
  review: TaskTeamCard[];
  next: TaskTeamCard[];
  done: TaskTeamCard[];
}

export interface TaskTeamPerson {
  /** null: tasks nobody owns. */
  email: string | null;
  lastActiveAt: string | null;
  updatesThisWeek: number;
  /** Open tasks they own, whatever the scope. */
  open: number;
  columns: TaskTeamColumns;
}

export interface TaskTeamPage {
  scope: TaskTeamScope;
  area: TaskArea | null;
  sprint: TaskSprint;
  people: TaskTeamPerson[];
  summary: { people: number; working: number; blocked: number; review: number; quiet: number; doneThisWeek: number };
  truncated: boolean;
}

/** Where a search found its words. */
export type TaskSearchField =
  | "number"
  | "title"
  | "description"
  | "update"
  | "checklist"
  | "label"
  | "brief"
  | "person"
  | "link";

export interface TaskSearchMatch {
  field: TaskSearchField;
  /** The words around the match; null for the title or a number. */
  text: string | null;
  /** An update's author and time. */
  author: TaskAuthor | null;
  at: string | null;
}

export interface TaskSearchResult {
  task: TaskRow;
  match: TaskSearchMatch;
}

/** Every board, open and closed, best first. */
export interface TaskSearchPage {
  q: string;
  results: TaskSearchResult[];
  hasMore: boolean;
}

// ---- Marketing --------------------------------------------------------------

/** Where a piece goes out (monday's Type). */
export const TASK_CHANNELS = [
  "x_post",
  "x_thread",
  "telegram",
  "email",
  "push",
  "in_app",
  "blog",
  "support_article",
  "video",
  "launch",
  "other",
] as const;
export type TaskChannel = (typeof TASK_CHANNELS)[number];

/** A piece's stage (monday's statuses); it sets the task's status. */
export const TASK_STAGES = [
  "coming",
  "in_progress",
  "waiting_approval",
  "approved",
  "scheduled",
  "pending_launch",
  "posted",
  "stuck",
] as const;
export type TaskStage = (typeof TASK_STAGES)[number];

export const TASK_CAMPAIGN_COLORS = ["indigo", "amber", "emerald", "sky", "violet", "pink", "orange", "slate"] as const;
export type TaskCampaignColor = (typeof TASK_CAMPAIGN_COLORS)[number];

export const TASK_BRIEF_FIELDS = ["audience", "objective", "keyMessage", "tone", "format", "visual", "cta"] as const;
export type TaskBriefField = (typeof TASK_BRIEF_FIELDS)[number];
export type TaskBrief = Partial<Record<TaskBriefField, string>>;

export interface TaskMarketing {
  campaignId: string | null;
  /** The launch it is part of. */
  parentId: string | null;
  channel: TaskChannel | null;
  stage: TaskStage;
  publishOn: string | null;
  /** `HH:mm`, Israel time. */
  publishTime: string | null;
  assetUrl: string | null;
  brief: TaskBrief;
  approvers: string[];
  approvalRequestedAt: string | null;
  approvalRequestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface TaskCampaign {
  id: string;
  name: string;
  startOn: string | null;
  endOn: string | null;
  color: TaskCampaignColor;
  archived: boolean;
  createdAt: string;
}

export interface TaskMarketingOverview {
  campaigns: TaskCampaign[];
  pieces: TaskRow[];
  truncated: boolean;
}

/** A piece's fields to set; left out stays, null clears. */
export interface TaskMarketingInput {
  campaignId?: string | null;
  parentId?: string | null;
  channel?: TaskChannel | null;
  stage?: TaskStage;
  publishOn?: string | null;
  publishTime?: string | null;
  assetUrl?: string | null;
  brief?: TaskBrief | null;
  approvers?: string[];
}

export interface TaskCampaignInput {
  name?: string;
  startOn?: string | null;
  endOn?: string | null;
  color?: TaskCampaignColor;
  archived?: boolean;
}

export interface TaskDetail extends TaskRow {
  description: { body: string; format: TaskBodyFormat; mentions: string[]; attachments: TaskAttachment[] };
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
  /** Product or support work; both when absent. */
  area?: TaskArea;
}

/** A week, Monday to Sunday (UTC), named by its Monday. */
export interface TaskSprint {
  start: string;
  end: string;
  /** "Nov 9–15". */
  label: string;
  when: "past" | "current" | "future";
}

export interface TaskSprintPage {
  sprint: TaskSprint;
  previous: TaskSprint;
  next: TaskSprint;
  /** Its tasks, open and closed. */
  rows: TaskRow[];
  /** Open product tasks in no sprint, most urgent first; empty when the sprint is over. */
  backlog: TaskRow[];
  backlogHasMore: boolean;
}

/** Who an escalated support case waits on. */
export type TaskPartner =
  | "wirex"
  | "rain"
  | "sumsub"
  | "didit"
  | "persona"
  | "card_issuer"
  | "kyc_provider"
  | "on_ramp"
  | "engineering"
  | "other";

export interface TaskPartnerCase {
  caseId: string;
  conversationId: string;
  caseNumber: number;
  userId: string | null;
  customer: string | null;
  intent: string | null;
  target: string;
  /** The partner's own id for the customer (Wirex user id, Rain consumer id). */
  partnerId: string | null;
  reason: string;
  externalRef: string | null;
  followUpAt: string;
  escalatedAt: string;
  escalatedBy: string;
  assigneeEmail: string | null;
  customerWroteSince: boolean;
  /** The follow-up passed and it went back to the inbox: chase the partner. */
  backInInbox: boolean;
  /** `title` is missing from servers older than the partner-wait title change. */
  task: { id: string; number: number; title?: string } | null;
}

export interface TaskPartnerGroup {
  partner: TaskPartner;
  label: string;
  cases: TaskPartnerCase[];
  overdue: number;
}

export interface TaskPartners {
  groups: TaskPartnerGroup[];
  total: number;
  /** Who some customers are with couldn't be read; they're under "unknown". */
  partnersUnavailable?: boolean;
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
  /** `html` from the rich editor. */
  format?: TaskBodyFormat;
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
  /** A day in the sprint (this one or later); the backlog when absent. */
  sprint?: string;
  visibility?: TaskVisibility;
  /** A marketing piece: puts it on the Marketing board. */
  marketing?: TaskMarketingInput;
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
  /** A day in the sprint (this one or later); null puts it back in the backlog. */
  sprint?: string | null;
  visibility?: TaskVisibility;
  marketing?: TaskMarketingInput;
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


// ---- Claude's jobs -----------------------------------------------------------

/**
 * A job an admin left by tagging @Claude on a task (when the backend queues
 * them for the hourly run). waiting → working → done | stuck; a code job
 * goes on through in_review and ready_to_ship, then shipping once someone
 * on the ship list presses Ship to production.
 */
export type ClaudeJobState =
  | "waiting"
  | "working"
  | "in_review"
  | "ready_to_ship"
  | "shipping"
  | "done"
  | "stuck"
  | "cancelled";

export type ClaudeJobKind = "question" | "design" | "admin" | "reply" | "code";

export interface ClaudeJobPr {
  /** `owner/name`. */
  repo: string;
  number: number;
  url: string;
  /** The branch it merges into (`master`, `main`, `qa`). */
  base: string;
}

export interface ClaudeJob {
  id: string;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  threadId: string;
  state: ClaudeJobState;
  kind: ClaudeJobKind | null;
  ask: string;
  askedBy: { email: string; name: string | null };
  allowed: { code: boolean };
  attempts: number;
  note: string | null;
  links: Array<{ label: string; url: string }>;
  prs: ClaudeJobPr[];
  go: { by: string; at: string } | null;
  /** The signed-in admin may press Ship to production on it now. */
  canShip: boolean;
  /** The signed-in admin may cancel it now. */
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClaudeJobs {
  jobs: ClaudeJob[];
  /** @Claude is queued for the hourly run (not answered at once). */
  queue: boolean;
}
