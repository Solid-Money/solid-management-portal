import type {
  NudgeCategory,
  NudgeCopyRule,
  NudgeDestinationView,
  NudgeEdge,
  NudgeEdgeKind,
  NudgeFieldChange,
  NudgePatch,
  NudgeSettingsPatch,
  NudgeSettingsView,
  NudgeStatus,
  NudgeVariable,
  NudgeView,
} from "@/types/nudges";

/**
 * Pure logic behind Growth → Automated nudges: how the nudges split into
 * linked groups for the graph, the ELK layout input, copy checks and the
 * patch an edit turns into. No React, so it is unit tested on its own.
 */

// ---------------------------------------------------------------------------
// Graph grouping
// ---------------------------------------------------------------------------

export interface NudgeSection {
  /** Stable id: the first key of the group, or "standalone". */
  id: string;
  title: string;
  /** Nudges that have no link to any other nudge. */
  standalone: boolean;
  keys: string[];
  counts: Record<NudgeStatus, number>;
}

/** The edges whose both ends are on the board. */
export function boardEdges(
  nudges: NudgeView[]
): Array<NudgeEdge & { from: string }> {
  const keys = new Set(nudges.map((n) => n.key));
  return nudges.flatMap((n) =>
    n.edges
      .filter((e) => keys.has(e.to) && e.to !== n.key)
      .map((e) => ({ ...e, from: n.key }))
  );
}

/**
 * Nudges linked by any edge, in either direction, end up in one group. Edges
 * to a nudge not on the board are ignored. Groups keep the board's order.
 */
export function connectedComponents(nudges: NudgeView[]): string[][] {
  const parent = new Map<string, string>();
  for (const n of nudges) parent.set(n.key, n.key);

  const find = (key: string): string => {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cursor = key;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor) as string;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };

  for (const edge of boardEdges(nudges)) {
    const a = find(edge.from);
    const b = find(edge.to);
    if (a !== b) parent.set(b, a);
  }

  const groups = new Map<string, string[]>();
  for (const n of nudges) {
    const root = find(n.key);
    const group = groups.get(root);
    if (group) group.push(n.key);
    else groups.set(root, [n.key]);
  }
  return [...groups.values()];
}

function emptyCounts(): Record<NudgeStatus, number> {
  return { live: 0, paused: 0, draft: 0, archived: 0 };
}

/**
 * The collapsible sections of the board: one per linked group, ordered by the
 * earliest journey stage among its nudges, then one "Standalone nudges"
 * section for every nudge linked to nothing.
 */
export function groupIntoSections(
  nudges: NudgeView[],
  flows: { id: string; label: string }[]
): NudgeSection[] {
  const byKey = new Map(nudges.map((n) => [n.key, n]));
  const flowOrder = new Map(flows.map((f, index) => [f.id, index]));
  const flowLabel = new Map(flows.map((f) => [f.id, f.label]));
  const orderOf = (key: string) =>
    flowOrder.get(byKey.get(key)?.flow ?? "") ?? flows.length;

  const sections: NudgeSection[] = [];
  const standalone: string[] = [];

  for (const keys of connectedComponents(nudges)) {
    if (keys.length === 1) {
      standalone.push(keys[0]);
      continue;
    }
    const counts = emptyCounts();
    const flowIds: string[] = [];
    for (const key of keys) {
      const nudge = byKey.get(key) as NudgeView;
      counts[nudge.status] += 1;
      if (!flowIds.includes(nudge.flow)) flowIds.push(nudge.flow);
    }
    flowIds.sort(
      (a, b) =>
        (flowOrder.get(a) ?? flows.length) - (flowOrder.get(b) ?? flows.length)
    );
    sections.push({
      id: keys[0],
      title: flowIds.map((id) => flowLabel.get(id) ?? id).join(" · "),
      standalone: false,
      keys,
      counts,
    });
  }

  // A group that starts in onboarding and runs into KYC sits with onboarding.
  const sectionOrder = (section: NudgeSection) =>
    Math.min(...section.keys.map(orderOf));
  sections.sort((a, b) => sectionOrder(a) - sectionOrder(b));

  if (standalone.length > 0) {
    standalone.sort((a, b) => orderOf(a) - orderOf(b));
    const counts = emptyCounts();
    for (const key of standalone) counts[(byKey.get(key) as NudgeView).status] += 1;
    sections.push({
      id: "standalone",
      title: "Standalone nudges",
      standalone: true,
      keys: standalone,
      counts,
    });
  }
  return sections;
}

// ---------------------------------------------------------------------------
// ELK layout
// ---------------------------------------------------------------------------

export const NUDGE_NODE_WIDTH = 280;
export const NUDGE_NODE_HEIGHT = 168;

export interface ElkGraphInput {
  id: string;
  layoutOptions: Record<string, string>;
  children: Array<{ id: string; width: number; height: number }>;
  edges: Array<{ id: string; sources: string[]; targets: string[] }>;
}

/** A stable id for one edge on the canvas. */
export function edgeId(from: string, edge: NudgeEdge): string {
  return `${from}->${edge.to}:${edge.kind}`;
}

/**
 * ELK input for one section: layered, left to right. A standalone section has
 * no edges, so it is laid out as a wrapped grid instead of one long row.
 */
export function elkGraphInput(
  nudges: NudgeView[],
  keys: string[],
  standalone = false
): ElkGraphInput {
  const inSection = new Set(keys);
  const sectionNudges = nudges.filter((n) => inSection.has(n.key));
  const edges = boardEdges(sectionNudges);
  const seen = new Set<string>();
  return {
    id: "root",
    layoutOptions: standalone
      ? {
          "elk.algorithm": "rectpacking",
          "elk.spacing.nodeNode": "32",
          "elk.aspectRatio": "2.4",
        }
      : {
          "elk.algorithm": "layered",
          "elk.direction": "RIGHT",
          "elk.layered.spacing.nodeNodeBetweenLayers": "80",
          "elk.spacing.nodeNode": "40",
          "elk.spacing.edgeNode": "24",
          "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
          "elk.edgeRouting": "ORTHOGONAL",
        },
    children: sectionNudges.map((n) => ({
      id: n.key,
      width: NUDGE_NODE_WIDTH,
      height: NUDGE_NODE_HEIGHT,
    })),
    edges: edges
      .map((e) => ({ id: edgeId(e.from, e), sources: [e.from], targets: [e.to] }))
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      }),
  };
}

/** How each kind of link is drawn: solid, dashed or dotted. */
export function edgeDash(kind: NudgeEdgeKind): string | undefined {
  switch (kind) {
    case "then":
      return undefined;
    case "replaces":
      return "2 4";
    default:
      return "6 4";
  }
}

// ---------------------------------------------------------------------------
// Copy checks
// ---------------------------------------------------------------------------

const VARIABLE = /\{(\w+)\}/g;

/** Every `{name}` in the text, once each, in order. */
export function extractVariables(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(VARIABLE)) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/** The `{name}`s the nudge does not provide. */
export function unknownVariables(
  text: string,
  variables: NudgeVariable[]
): string[] {
  const known = new Set(variables.map((v) => v.name));
  return extractVariables(text).filter((name) => !known.has(name));
}

/** Fill `{name}` with each variable's example, for previews. */
export function renderExample(text: string, variables: NudgeVariable[]): string {
  const examples = new Map(variables.map((v) => [v.name, v.example]));
  return text.replace(VARIABLE, (match, name: string) =>
    examples.has(name) ? (examples.get(name) as string) : match
  );
}

/** The messages of every copy rule the text breaks. Bad patterns are skipped. */
export function copyRuleMatches(text: string, rules: NudgeCopyRule[]): string[] {
  const messages: string[] = [];
  for (const rule of rules) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(rule.pattern, "i");
    } catch {
      continue;
    }
    if (pattern.test(text) && !messages.includes(rule.message)) {
      messages.push(rule.message);
    }
  }
  return messages;
}

export interface PushLimits {
  pushTitleMax: number;
  pushBodyMax: number;
  pushBodyCollapsed: number;
}

export interface CopyIssue {
  /** errors block a save; warnings are shown in the review. */
  level: "error" | "warning";
  message: string;
}

/** Length, variable and copy-rule problems in a push. */
export function pushCopyIssues(
  push: { title: string; body: string },
  variables: NudgeVariable[],
  limits: PushLimits,
  rules: NudgeCopyRule[]
): CopyIssue[] {
  const issues: CopyIssue[] = [];
  if (!push.title.trim()) {
    issues.push({ level: "error", message: "The push needs a title." });
  }
  if (push.title.length > limits.pushTitleMax) {
    issues.push({
      level: "error",
      message: `The title is ${push.title.length} characters; the most is ${limits.pushTitleMax}.`,
    });
  }
  if (push.body.length > limits.pushBodyMax) {
    issues.push({
      level: "error",
      message: `The body is ${push.body.length} characters; the most is ${limits.pushBodyMax}.`,
    });
  } else if (push.body.length > limits.pushBodyCollapsed) {
    issues.push({
      level: "warning",
      message: `The body is cut after about ${limits.pushBodyCollapsed} characters when the push is collapsed.`,
    });
  }
  const unknown = unknownVariables(`${push.title} ${push.body}`, variables);
  if (unknown.length > 0) {
    issues.push({
      level: "error",
      message: `This nudge has no ${unknown.map((n) => `{${n}}`).join(", ")}.`,
    });
  }
  for (const message of copyRuleMatches(`${push.title} ${push.body}`, rules)) {
    issues.push({ level: "warning", message });
  }
  return issues;
}

/** Brevo params the template uses that the nudge does not send. */
export function missingTemplateParams(
  templateParams: string[],
  variables: NudgeVariable[]
): string[] {
  const known = new Set(variables.map((v) => v.name));
  known.add("recipientName");
  return templateParams.filter((p) => !known.has(p));
}

/** `text` with `insert` put between `start` and `end`, and the new caret. */
export function insertAt(
  text: string,
  insert: string,
  start: number,
  end = start
): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  return {
    text: text.slice(0, from) + insert + text.slice(to),
    caret: from + insert.length,
  };
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

function normalizePath(path: string): { pathname: string; query: string } {
  const trimmed = path.trim();
  const [rawPath, rawQuery = ""] = trimmed.split("?");
  let pathname = rawPath || "/";
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  const params = new URLSearchParams(rawQuery);
  const entries = [...params.entries()]
    .filter(([key]) => !key.startsWith("utm_"))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  // Serialised as JSON, not joined back into "k=v&…": a decoded value can
  // itself hold "&" or "=", and two different queries must never compare equal.
  return { pathname, query: JSON.stringify(entries) };
}

/** The catalog destination a path opens, ignoring utm params and order. */
export function destinationForPath(
  path: string,
  destinations: NudgeDestinationView[]
): NudgeDestinationView | null {
  const target = normalizePath(path);
  return (
    destinations.find((d) => {
      const candidate = normalizePath(d.path);
      return (
        candidate.pathname === target.pathname && candidate.query === target.query
      );
    }) ?? null
  );
}

/** Whether a custom path is something the app can open: "/x/y?a=b". */
export function isValidAppPath(path: string): boolean {
  return /^\/[A-Za-z0-9\-._~/]*(\?[A-Za-z0-9\-._~=&%]*)?$/.test(path.trim());
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

export interface NudgePushDraft {
  enabled: boolean;
  title: string;
  body: string;
  path: string;
  destinationId: string | null;
  imageUrl: string | null;
}

export interface NudgeEmailDraft {
  enabled: boolean;
  templateId: number | null;
}

/** The editable fields of a nudge, as the editor holds them. */
export interface NudgeDraft {
  name: string;
  description: string;
  status: NudgeStatus;
  category: NudgeCategory;
  priority: number;
  delayMinutes: number | null;
  cooldownDays: number | null;
  suppressionGroup: string | null;
  conditions: string[];
  push: NudgePushDraft | null;
  email: NudgeEmailDraft | null;
}

export function draftFromNudge(nudge: NudgeView): NudgeDraft {
  return {
    name: nudge.name,
    description: nudge.description,
    status: nudge.status,
    category: nudge.category,
    priority: nudge.priority,
    delayMinutes: nudge.trigger.delayMinutes ?? null,
    cooldownDays: nudge.cooldownDays,
    suppressionGroup: nudge.suppressionGroup,
    conditions: [...nudge.conditions],
    push: nudge.push
      ? {
          enabled: nudge.push.enabled,
          title: nudge.push.title,
          body: nudge.push.body,
          path: nudge.push.path,
          destinationId: nudge.push.destinationId,
          imageUrl: nudge.push.imageUrl,
        }
      : null,
    email: nudge.email
      ? { enabled: nudge.email.enabled, templateId: nudge.email.templateId }
      : null,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  return a === b;
}

/** Blank optional text counts as "none". */
function emptyToNull(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value.trim();
}

/**
 * The patch an edit sends and the field-by-field list the review shows: only
 * what differs from the saved nudge. An empty patch means nothing to save.
 */
export function diffNudge(
  nudge: NudgeView,
  draft: NudgeDraft
): { patch: NudgePatch; changes: NudgeFieldChange[] } {
  const saved = draftFromNudge(nudge);
  const patch: NudgePatch = {};
  const changes: NudgeFieldChange[] = [];
  const note = (field: string, from: unknown, to: unknown) =>
    changes.push({ field, from, to });

  const top = [
    "name",
    "description",
    "status",
    "category",
    "priority",
    "delayMinutes",
    "cooldownDays",
    "suppressionGroup",
    "conditions",
  ] as const;
  for (const field of top) {
    const from = saved[field];
    let to = draft[field];
    if (field === "suppressionGroup") to = emptyToNull(draft.suppressionGroup);
    if (!sameValue(from, to)) {
      (patch as Record<string, unknown>)[field] = to;
      note(field, from, to);
    }
  }

  if (saved.push && draft.push) {
    const pushPatch: NonNullable<NudgePatch["push"]> = {};
    const fields = [
      "enabled",
      "title",
      "body",
      "path",
      "destinationId",
      "imageUrl",
    ] as const;
    for (const field of fields) {
      const from = saved.push[field];
      let to = draft.push[field];
      if (field === "imageUrl") to = emptyToNull(draft.push.imageUrl);
      if (field === "path") to = draft.push.path.trim();
      if (!sameValue(from, to)) {
        (pushPatch as Record<string, unknown>)[field] = to;
        note(`push.${field}`, from, to);
      }
    }
    if (Object.keys(pushPatch).length > 0) patch.push = pushPatch;
  }

  if (saved.email && draft.email) {
    const emailPatch: NonNullable<NudgePatch["email"]> = {};
    if (saved.email.enabled !== draft.email.enabled) {
      emailPatch.enabled = draft.email.enabled;
      note("email.enabled", saved.email.enabled, draft.email.enabled);
    }
    if (saved.email.templateId !== draft.email.templateId) {
      emailPatch.templateId = draft.email.templateId;
      note("email.templateId", saved.email.templateId, draft.email.templateId);
    }
    if (Object.keys(emailPatch).length > 0) patch.email = emailPatch;
  }

  return { patch, changes };
}

/** The same for the global rules. */
export function diffSettings(
  saved: NudgeSettingsView,
  draft: NudgeSettingsView
): { patch: NudgeSettingsPatch; changes: NudgeFieldChange[] } {
  const patch: NudgeSettingsPatch = {};
  const changes: NudgeFieldChange[] = [];

  for (const field of ["marketingEnabled", "respectMarketingConsent"] as const) {
    if (saved[field] !== draft[field]) {
      patch[field] = draft[field];
      changes.push({ field, from: saved[field], to: draft[field] });
    }
  }

  const cap: NonNullable<NudgeSettingsPatch["frequencyCap"]> = {};
  for (const field of ["enabled", "perDay", "perWeek"] as const) {
    if (saved.frequencyCap[field] !== draft.frequencyCap[field]) {
      (cap as Record<string, unknown>)[field] = draft.frequencyCap[field];
      changes.push({
        field: `frequencyCap.${field}`,
        from: saved.frequencyCap[field],
        to: draft.frequencyCap[field],
      });
    }
  }
  if (Object.keys(cap).length > 0) patch.frequencyCap = cap;

  const quiet: NonNullable<NudgeSettingsPatch["quietHours"]> = {};
  for (const field of ["enabled", "start", "end", "fallbackTimezone"] as const) {
    if (saved.quietHours[field] !== draft.quietHours[field]) {
      (quiet as Record<string, unknown>)[field] = draft.quietHours[field];
      changes.push({
        field: `quietHours.${field}`,
        from: saved.quietHours[field],
        to: draft.quietHours[field],
      });
    }
  }
  if (Object.keys(quiet).length > 0) patch.quietHours = quiet;

  const groupsChanged =
    saved.suppressionGroups.length !== draft.suppressionGroups.length ||
    saved.suppressionGroups.some((g, i) => {
      const d = draft.suppressionGroups[i];
      return g.id !== d.id || g.label !== d.label || g.days !== d.days;
    });
  if (groupsChanged) {
    patch.suppressionGroups = draft.suppressionGroups;
    changes.push({
      field: "suppressionGroups",
      from: saved.suppressionGroups.map(describeGroup).join(", ") || "none",
      to: draft.suppressionGroups.map(describeGroup).join(", ") || "none",
    });
  }

  return { patch, changes };
}

function describeGroup(group: { id: string; days: number }): string {
  return `${group.id} (${group.days}d)`;
}

/** Whether this browser knows `zone` as an IANA time zone, e.g. "Europe/Berlin". */
export function isValidTimeZone(zone: string): boolean {
  const trimmed = zone.trim();
  if (!trimmed) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/** Problems with the rules that block a save. */
export function settingsIssues(settings: NudgeSettingsView): string[] {
  const issues: string[] = [];
  const { perDay, perWeek } = settings.frequencyCap;
  if (!Number.isInteger(perDay) || perDay < 1) {
    issues.push("The daily cap must be a whole number of at least 1.");
  }
  if (!Number.isInteger(perWeek) || perWeek < 1) {
    issues.push("The weekly cap must be a whole number of at least 1.");
  }
  if (Number.isInteger(perDay) && Number.isInteger(perWeek) && perWeek < perDay) {
    issues.push("The weekly cap cannot be lower than the daily cap.");
  }
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(settings.quietHours.start) || !time.test(settings.quietHours.end)) {
    issues.push("Quiet hours need a start and end as HH:mm.");
  }
  if (!settings.quietHours.fallbackTimezone.trim()) {
    issues.push("Quiet hours need a fallback time zone.");
  } else if (!isValidTimeZone(settings.quietHours.fallbackTimezone)) {
    issues.push(
      `"${settings.quietHours.fallbackTimezone.trim()}" is not a time zone. Use an IANA zone such as Europe/Berlin or UTC.`
    );
  }
  const ids = new Set<string>();
  for (const group of settings.suppressionGroups) {
    if (!/^[a-z0-9-]{2,40}$/.test(group.id)) {
      issues.push(
        `Group id "${group.id}" must be 2-40 lowercase letters, digits or dashes.`
      );
    }
    if (ids.has(group.id)) issues.push(`Group id "${group.id}" is used twice.`);
    ids.add(group.id);
    if (!group.label.trim()) issues.push(`Group "${group.id}" needs a label.`);
    if (!Number.isInteger(group.days) || group.days < 1) {
      issues.push(`Group "${group.id}" needs a whole number of days.`);
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Rebasing an edit onto a newer saved version
// ---------------------------------------------------------------------------

const TOP_FIELDS = [
  "name",
  "description",
  "status",
  "category",
  "priority",
  "delayMinutes",
  "cooldownDays",
  "suppressionGroup",
  "conditions",
] as const;
const PUSH_FIELDS = [
  "enabled",
  "title",
  "body",
  "path",
  "destinationId",
  "imageUrl",
] as const;
const EMAIL_FIELDS = ["enabled", "templateId"] as const;

/**
 * Carry an unsaved edit over to a newer saved version: start from what is
 * saved now and re-apply only the fields the admin changed from the version
 * they started on. `overlapping` names the fields both the admin and the newer
 * version changed (to different values), which the admin's value now replaces.
 */
export function rebaseDraft(
  startedFrom: NudgeView,
  draft: NudgeDraft,
  latest: NudgeView
): { draft: NudgeDraft; overlapping: string[] } {
  const before = draftFromNudge(startedFrom);
  const next = draftFromNudge(latest);
  const overlapping: string[] = [];
  const carry = (
    field: string,
    was: unknown,
    mine: unknown,
    theirs: unknown,
    apply: () => void
  ) => {
    if (sameValue(was, mine)) return;
    if (!sameValue(was, theirs) && !sameValue(theirs, mine)) overlapping.push(field);
    apply();
  };

  for (const field of TOP_FIELDS) {
    carry(field, before[field], draft[field], next[field], () => {
      (next as unknown as Record<string, unknown>)[field] = draft[field];
    });
  }
  if (before.push && draft.push && next.push) {
    const push = { ...next.push };
    for (const field of PUSH_FIELDS) {
      carry(`push.${field}`, before.push[field], draft.push[field], push[field], () => {
        (push as unknown as Record<string, unknown>)[field] = draft.push?.[field];
      });
    }
    next.push = push;
  }
  if (before.email && draft.email && next.email) {
    const email = { ...next.email };
    for (const field of EMAIL_FIELDS) {
      carry(`email.${field}`, before.email[field], draft.email[field], email[field], () => {
        (email as unknown as Record<string, unknown>)[field] = draft.email?.[field];
      });
    }
    next.email = email;
  }
  return { draft: next, overlapping };
}

/** The rules as flat fields, for rebasing and comparing. */
function flatSettings(settings: NudgeSettingsView): Record<string, unknown> {
  return {
    marketingEnabled: settings.marketingEnabled,
    respectMarketingConsent: settings.respectMarketingConsent,
    "frequencyCap.enabled": settings.frequencyCap.enabled,
    "frequencyCap.perDay": settings.frequencyCap.perDay,
    "frequencyCap.perWeek": settings.frequencyCap.perWeek,
    "quietHours.enabled": settings.quietHours.enabled,
    "quietHours.start": settings.quietHours.start,
    "quietHours.end": settings.quietHours.end,
    "quietHours.fallbackTimezone": settings.quietHours.fallbackTimezone,
    suppressionGroups: JSON.stringify(settings.suppressionGroups),
  };
}

/** The same as rebaseDraft, for the global rules. */
export function rebaseSettings(
  startedFrom: NudgeSettingsView,
  draft: NudgeSettingsView,
  latest: NudgeSettingsView
): { draft: NudgeSettingsView; overlapping: string[] } {
  const was = flatSettings(startedFrom);
  const mine = flatSettings(draft);
  const theirs = flatSettings(latest);
  const next: NudgeSettingsView = {
    ...latest,
    frequencyCap: { ...latest.frequencyCap },
    quietHours: { ...latest.quietHours },
    suppressionGroups: latest.suppressionGroups.map((g) => ({ ...g })),
  };
  const overlapping: string[] = [];
  for (const field of Object.keys(mine)) {
    if (sameValue(was[field], mine[field])) continue;
    if (!sameValue(was[field], theirs[field]) && !sameValue(theirs[field], mine[field])) {
      overlapping.push(field);
    }
    if (field === "suppressionGroups") {
      next.suppressionGroups = draft.suppressionGroups.map((g) => ({ ...g }));
    } else if (field.startsWith("frequencyCap.")) {
      const key = field.slice("frequencyCap.".length) as keyof NudgeSettingsView["frequencyCap"];
      (next.frequencyCap as Record<string, unknown>)[key] = draft.frequencyCap[key];
    } else if (field.startsWith("quietHours.")) {
      const key = field.slice("quietHours.".length) as keyof NudgeSettingsView["quietHours"];
      (next.quietHours as Record<string, unknown>)[key] = draft.quietHours[key];
    } else {
      (next as unknown as Record<string, unknown>)[field] =
        draft[field as "marketingEnabled" | "respectMarketingConsent"];
    }
  }
  return { draft: next, overlapping };
}

/** A field change's value, as one line of text. */
export function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "on" : "off";
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map(formatChangeValue).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** A key for a new nudge, from its name: "Friend joined" -> "friend-joined". */
export function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/** Whether a nudge can be edited by this admin. */
export function isEditable(nudge: NudgeView, canEdit: boolean): boolean {
  return canEdit && nudge.source === "config" && nudge.managed;
}

/** "90" -> "1h 30m", "2880" -> "2d". */
export function formatDelay(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes === 0) return "at once";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", mins ? `${mins}m` : ""]
    .filter(Boolean)
    .join(" ");
}
