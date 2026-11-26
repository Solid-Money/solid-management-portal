import type {
  PushCampaignAudienceFilters,
  PushCampaignDetail,
  PushCampaignLimits,
  PushCampaignSummary,
  PushCampaignTier,
  PushCampaignVariantInput,
  PushCampaignVariantKey,
  PushDestination,
  PushDestinationGroup,
} from "@/types/push-campaigns";

/**
 * Pure logic behind Growth → Push notifications: reading an uploaded audience,
 * the labels a campaign's pushes will carry, the expected split, and what
 * stops a form from being sent. Kept free of React so it is unit-tested.
 *
 * The slug and split mirror accounts-service (`pushCampaignSlug`,
 * `splitAudience`): the portal only previews them, the backend decides.
 */

export const VARIANT_KEYS: readonly PushCampaignVariantKey[] = ["a", "b", "c"];

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Header names an exported user list puts its id column under. */
const USER_ID_HEADERS = new Set([
  "user_id",
  "userid",
  "user id",
  "id",
  "_id",
  "user",
]);

export interface ParsedAudience {
  /** Distinct user ids, lower-cased, in the order they first appeared. */
  ids: string[];
  /** Distinct entries that are not a user id. */
  invalid: string[];
  /** Repeats of an id already counted. */
  duplicates: number;
  /** Where the ids were read from, for the form to say. */
  source: "column" | "list";
  /** The header of the column read, when `source` is `column`. */
  column?: string;
}

/**
 * The records of a CSV text, each a list of trimmed fields.
 *
 * Quotes are honoured across line breaks: a quoted field may hold a comma, a
 * `""`-escaped quote or a newline, and still belongs to its own record, so a
 * multi-line value in one column never shifts the columns after it. Blank
 * records are dropped.
 */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    record.push(field.trim());
    field = "";
  };
  const endRecord = () => {
    endField();
    if (record.some((f) => f !== "")) records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRecord();
    } else {
      field += char;
    }
  }
  endRecord();
  return records;
}

/** One CSV line's fields, honouring double-quoted fields and `""` escapes. */
export function splitCsvLine(line: string): string[] {
  return parseCsvRecords(line)[0] ?? [""];
}

/**
 * The user ids in a pasted list or an uploaded CSV.
 *
 * A CSV whose first record names a user id column (`user_id`, as an Amplitude
 * cohort export writes it, or `id`, `_id`, `userId`) is read from that column
 * only, so the export's other columns are not mistaken for bad ids. Records,
 * not lines, are read, so a quoted value with a line break in an earlier column
 * cannot cost a row its id. Anything else is read as a list split on
 * whitespace, commas and semicolons.
 */
export function parseAudience(text: string): ParsedAudience {
  const records = parseCsvRecords(text);
  const header = records[0] ?? [];
  const column = header.findIndex((name) =>
    USER_ID_HEADERS.has(name.toLowerCase()),
  );

  const fromColumn = column >= 0;
  const tokens = fromColumn
    ? records.slice(1).map((record) => record[column] ?? "")
    : text.split(/[\s,;"']+/);

  const seen = new Set<string>();
  const invalid = new Set<string>();
  const ids: string[] = [];
  let duplicates = 0;
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    if (!OBJECT_ID.test(token)) {
      invalid.add(token);
      continue;
    }
    const id = token.toLowerCase();
    if (seen.has(id)) {
      duplicates++;
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return {
    ids,
    invalid: [...invalid],
    duplicates,
    source: fromColumn ? "column" : "list",
    column: fromColumn ? header[column] : undefined,
  };
}

/** Whether two id lists hold the same ids, whatever their order. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** The slug a campaign name becomes; mirrors accounts-service. */
export function campaignSlug(name: string): string {
  return (
    name
      .normalize("NFKD")
      // The accents NFKD split off: "crème" is one word, not "cre_me".
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32)
      .replace(/_+$/g, "")
  );
}

/** `data.type` / FCM analytics label of one variant's pushes. */
export function campaignType(slug: string, key: PushCampaignVariantKey) {
  return `campaign-${slug}-${key}`;
}

export interface ExpectedSplit {
  control: number;
  /** People per variant; the arms differ by at most one. */
  arms: number[];
}

/**
 * How a reachable audience splits: the control group is the rounded share,
 * the rest dealt round-robin. The backend shuffles who lands where; the sizes
 * are exactly these.
 */
export function expectedSplit(
  reachable: number,
  variantCount: number,
  controlPercent: number,
): ExpectedSplit {
  const control = Math.round((reachable * controlPercent) / 100);
  const rest = Math.max(0, reachable - control);
  const arms = Array.from(
    { length: variantCount },
    (_, k) =>
      Math.floor(rest / variantCount) + (k < rest % variantCount ? 1 : 0),
  );
  return { control, arms };
}

/** Destinations in the order of their groups, for an `<optgroup>` picker. */
export function groupDestinations(
  destinations: readonly PushDestination[],
): { group: PushDestinationGroup; items: PushDestination[] }[] {
  const groups = new Map<PushDestinationGroup, PushDestination[]>();
  for (const destination of destinations) {
    const items = groups.get(destination.group) ?? [];
    items.push(destination);
    groups.set(destination.group, items);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

/** One variant as the form holds it. */
export interface VariantDraft {
  title: string;
  body: string;
  destinationId: string;
  /**
   * Page of the active What's New, as a string from its `<select>`. Stays
   * blank for a single image or video, which has no pages.
   */
  whatsNewStep: string;
  /**
   * The announcement that page was picked from. Sent with it, so the backend
   * refuses the page if the announcement has been replaced since: page 3 of a
   * new announcement is different content.
   */
  whatsNewId: string;
}

export const emptyVariant = (): VariantDraft => ({
  title: "",
  body: "",
  destinationId: "",
  whatsNewStep: "",
  whatsNewId: "",
});

/** What is wrong with one variant, or null when it can be sent. */
export function variantProblem(
  draft: VariantDraft,
  destinations: readonly PushDestination[],
  whatsNew: { id: string; format?: string; steps: unknown[] } | null,
  limits: Pick<PushCampaignLimits, "titleMaxLength" | "bodyMaxLength">,
): string | null {
  const title = draft.title.trim();
  if (!title) return "Write a title.";
  if (title.length > limits.titleMaxLength) {
    return `The title is over ${limits.titleMaxLength} characters.`;
  }
  if (draft.body.trim().length > limits.bodyMaxLength) {
    return `The text is over ${limits.bodyMaxLength} characters.`;
  }
  const destination = destinations.find((d) => d.id === draft.destinationId);
  if (!destination) return "Choose where the push opens.";
  if (destination.needsWhatsNewStep) {
    // A single image or video opens as it is: no page to choose. A page still
    // on the draft was picked while it was a carousel, and the backend refuses
    // a page for a single, so it is chosen again (which clears the page).
    if (whatsNew?.format === "single") {
      return draft.whatsNewStep !== "" ||
        (draft.whatsNewId && draft.whatsNewId !== whatsNew.id)
        ? "The What's New announcement changed. Choose it again."
        : null;
    }
    if (!whatsNew || whatsNew.steps.length === 0) {
      return "There is no active What's New announcement to open.";
    }
    if (draft.whatsNewStep !== "" && draft.whatsNewId !== whatsNew.id) {
      return "The What's New announcement changed. Choose the page again.";
    }
    const step = Number(draft.whatsNewStep);
    if (
      draft.whatsNewStep === "" ||
      !Number.isInteger(step) ||
      step < 0 ||
      step >= whatsNew.steps.length
    ) {
      return "Choose the What's New page to open.";
    }
  }
  return null;
}

/** The variant as the API takes it. Call only once `variantProblem` is null. */
export function toVariantInput(
  draft: VariantDraft,
  destinations: readonly PushDestination[],
): PushCampaignVariantInput {
  const destination = destinations.find((d) => d.id === draft.destinationId);
  const body = draft.body.trim();
  return {
    title: draft.title.trim(),
    ...(body ? { body } : {}),
    destinationId: draft.destinationId,
    ...(destination?.needsWhatsNewStep
      ? {
          ...(draft.whatsNewId ? { whatsNewId: draft.whatsNewId } : {}),
          // None for a single image or video.
          ...(draft.whatsNewStep !== ""
            ? { whatsNewStep: Number(draft.whatsNewStep) }
            : {}),
        }
      : {}),
  };
}

/**
 * Test recipients typed into one field: ids or usernames, a leading `@`
 * dropped, split on whitespace and commas, deduped.
 */
export function parseTestRecipients(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((v) => v.trim().replace(/^@/, ""))
        .filter(Boolean),
    ),
  ];
}

/** The tiers a campaign can be narrowed to, in ladder order. */
export const TIER_LABELS: Record<PushCampaignTier, string> = {
  core: "Core",
  prime: "Prime",
  ultra: "Ultra",
};

/** Send-time filters as the form holds them. */
export interface FiltersDraft {
  /** Empty: every tier. */
  tiers: PushCampaignTier[];
  /** Count someone on a free trial by the tier they would have without it. */
  ignoreTrials: boolean;
  /** Earlier campaigns whose control groups are left out. */
  excludeControlOf: string[];
}

export const emptyFilters = (): FiltersDraft => ({
  tiers: [],
  // Someone trying Prime for free has not bought it: an upgrade push is for them.
  ignoreTrials: true,
  excludeControlOf: [],
});

/**
 * The filters as the API takes them, or undefined when they leave nobody out.
 * Every tier picked is the same as none.
 */
export function toFiltersInput(
  draft: FiltersDraft,
  allTiers: readonly PushCampaignTier[],
): PushCampaignAudienceFilters | undefined {
  const tiers =
    draft.tiers.length > 0 && draft.tiers.length < allTiers.length
      ? allTiers.filter((t) => draft.tiers.includes(t))
      : [];
  const filters: PushCampaignAudienceFilters = {
    ...(tiers.length > 0 ? { tiers, ignoreTrials: draft.ignoreTrials } : {}),
    ...(draft.excludeControlOf.length > 0
      ? { excludeControlOf: [...draft.excludeControlOf] }
      : {}),
  };
  return Object.keys(filters).length > 0 ? filters : undefined;
}

/** The form's filters for a stored campaign's. */
export function filtersDraftOf(
  filters?: PushCampaignAudienceFilters,
): FiltersDraft {
  return {
    tiers: filters?.tiers ? [...filters.tiers] : [],
    ignoreTrials: filters?.ignoreTrials ?? true,
    excludeControlOf: filters?.excludeControlOf
      ? [...filters.excludeControlOf]
      : [],
  };
}

/** Whether two filter inputs leave out the same people. */
export function sameFilters(
  a?: PushCampaignAudienceFilters,
  b?: PushCampaignAudienceFilters,
): boolean {
  const key = (f?: PushCampaignAudienceFilters) =>
    JSON.stringify({
      tiers: [...(f?.tiers ?? [])].sort(),
      ignoreTrials: f?.tiers?.length ? !!f.ignoreTrials : false,
      excludeControlOf: [...(f?.excludeControlOf ?? [])].sort(),
    });
  return key(a) === key(b);
}

/** One line on who the filters leave out, for a campaign card. */
export function describeFilters(
  filters: PushCampaignAudienceFilters | undefined,
  campaignName: (id: string) => string,
): string | null {
  if (!filters) return null;
  const parts: string[] = [];
  if (filters.tiers?.length) {
    parts.push(
      `only ${filters.tiers.map((t) => TIER_LABELS[t]).join(" and ")} at send time` +
        (filters.ignoreTrials ? " (free trials not counted)" : ""),
    );
  }
  if (filters.excludeControlOf?.length) {
    parts.push(
      `leaving out the control group of ${filters.excludeControlOf
        .map(campaignName)
        .join(", ")}`,
    );
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * An instant as the value of a `datetime-local` input, in this browser's time
 * zone (`2026-11-30T10:00`), or "" for none.
 */
export function toLocalInput(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A `datetime-local` value read in this browser's time zone, as an ISO instant. */
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A send time loaded for editing: as the input shows it, and as stored. */
export interface StoredSendAt {
  local: string;
  iso: string;
}

/**
 * The instant a `datetime-local` value stands for. Left as loaded, it is the
 * stored instant: read back from the local time, one the clocks pass twice
 * would come out as its first occurrence and could move the send an hour.
 */
export function sendAtInstant(
  value: string,
  stored?: StoredSendAt,
): string | null {
  if (stored && value === stored.local) return stored.iso;
  return localInputToIso(value);
}

/**
 * Whether a `datetime-local` value is a time the clocks pass twice here (when
 * they go back) or skip (when they go forward), or null for neither.
 */
export function localTimeClash(value: string): "repeated" | "skipped" | null {
  const iso = localInputToIso(value);
  if (!iso) return null;
  const at = new Date(iso).getTime();
  // A skipped time is read as the hour after it, so it reads back differently.
  if (toLocalInput(new Date(at)) !== value) return "skipped";
  // A repeated one is read as its first occurrence; the clocks go back by
  // half an hour, an hour or two.
  return [30, 60, 120].some(
    (minutes) => toLocalInput(new Date(at + minutes * 60_000)) === value,
  )
    ? "repeated"
    : null;
}

/** This browser's time zone, e.g. "Europe/Berlin (GMT+1)", at `at`. */
export function localTimeZoneLabel(at: Date = new Date()): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset =
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  return offset ? `${zone} (${offset})` : zone;
}

/** "Mon, Nov 30, 10:00" in this browser's time zone. */
export function formatLocalSendAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** "Mon, Nov 30, 09:00 UTC". */
export function formatUtcSendAt(iso: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(iso))} UTC`;
}

/** The default send time: the next whole hour at least an hour away. */
export function defaultSendAt(now: Date = new Date()): string {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 2);
  return toLocalInput(date);
}

/**
 * What is wrong with a send time, or null. Mirrors accounts-service, which
 * checks it again: at least `minLeadMinutes` ahead, at most `maxAheadDays`.
 * A time typed in must name one moment; one left as loaded (`stored`) does.
 */
export function sendTimeProblem(
  value: string,
  limits: Pick<PushCampaignLimits, "scheduleMinLeadMinutes" | "scheduleMaxAheadDays">,
  now: Date = new Date(),
  stored?: StoredSendAt,
): string | null {
  const iso = sendAtInstant(value, stored);
  if (!iso) return "Pick a date and time.";
  const kept = !!stored && value === stored.local;
  const clash = kept ? null : localTimeClash(value);
  if (clash === "repeated") {
    return "The clocks go back then in your time zone, so that time happens twice. Pick a time outside that hour.";
  }
  if (clash === "skipped") {
    return "The clocks go forward then in your time zone, so that time never happens. Pick another time.";
  }
  const lead = new Date(iso).getTime() - now.getTime();
  const minLead = limits.scheduleMinLeadMinutes ?? 2;
  if (lead < minLead * 60_000) {
    return `Pick a time at least ${minLead} minutes from now, or send it now.`;
  }
  const maxAhead = limits.scheduleMaxAheadDays ?? 60;
  if (lead > maxAhead * 24 * 60 * 60_000) {
    return `A campaign can be scheduled at most ${maxAhead} days ahead.`;
  }
  return null;
}

/** What the composer starts from when it edits a scheduled campaign. */
export interface ComposerSeed {
  name: string;
  reason: string;
  raw: string;
  variants: VariantDraft[];
  controlOn: boolean;
  controlPercent: string;
  filters: FiltersDraft;
  sendAt: string;
  /** The send time as stored, kept while `sendAt` is left as loaded. */
  storedSendAt?: StoredSendAt;
}

/** A scheduled campaign as the composer's starting state. */
export function seedFromCampaign(campaign: PushCampaignDetail): ComposerSeed {
  const sendAt = toLocalInput(campaign.sendAt);
  return {
    name: campaign.name,
    reason: campaign.reason ?? "",
    raw: campaign.userIds.join("\n"),
    variants: campaign.variants.map((v) => ({
      title: v.title,
      body: v.body ?? "",
      destinationId: v.destinationId,
      whatsNewStep:
        typeof v.whatsNewStep === "number" ? String(v.whatsNewStep) : "",
      whatsNewId: v.whatsNewId ?? "",
    })),
    controlOn: campaign.controlPercent > 0,
    controlPercent:
      campaign.controlPercent > 0 ? String(campaign.controlPercent) : "10",
    filters: filtersDraftOf(campaign.audienceFilters),
    sendAt,
    ...(sendAt && campaign.sendAt
      ? { storedSendAt: { local: sendAt, iso: campaign.sendAt } }
      : {}),
  };
}

/**
 * Earlier campaigns whose control group a new one can leave out: with a
 * control group, not called off, newest first. A scheduled one counts: its
 * control group exists by the time a later campaign goes out. A failed one
 * counts only if it stored its control group before failing (`assignedAt`),
 * the rule accounts-service applies too.
 */
export function controlGroupSources(
  campaigns: readonly PushCampaignSummary[],
  exceptId?: string,
): PushCampaignSummary[] {
  return campaigns.filter(
    (c) =>
      c.id !== exceptId &&
      c.controlPercent > 0 &&
      (c.status === "sent" ||
        c.status === "sending" ||
        c.status === "scheduled" ||
        (c.status === "failed" && !!c.assignedAt)),
  );
}
