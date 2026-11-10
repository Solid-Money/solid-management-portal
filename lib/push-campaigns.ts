import type {
  PushCampaignLimits,
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

/** One CSV line's fields, honouring double-quoted fields and `""` escapes. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
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
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

/**
 * The user ids in a pasted list or an uploaded CSV.
 *
 * A CSV whose first line names a user id column (`user_id`, as an Amplitude
 * cohort export writes it, or `id`, `_id`, `userId`) is read from that column
 * only, so the export's other columns are not mistaken for bad ids. Anything
 * else is read as a list split on whitespace, commas and semicolons.
 */
export function parseAudience(text: string): ParsedAudience {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const header = lines.length > 0 ? splitCsvLine(lines[0]) : [];
  const column = header.findIndex((name) =>
    USER_ID_HEADERS.has(name.toLowerCase()),
  );

  const fromColumn = column >= 0;
  const tokens = fromColumn
    ? lines.slice(1).map((line) => splitCsvLine(line)[column] ?? "")
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
  return name
    .normalize("NFKD")
    // The accents NFKD split off: "crème" is one word, not "cre_me".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .replace(/_+$/g, "");
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
  const arms = Array.from({ length: variantCount }, (_, k) =>
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
  /** Page of the active What's New, as a string from its `<select>`. */
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
  whatsNew: { id: string; steps: unknown[] } | null,
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
          whatsNewId: draft.whatsNewId,
          whatsNewStep: Number(draft.whatsNewStep),
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
