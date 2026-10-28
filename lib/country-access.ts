import type {
  CountryAccessListKey,
  CountryOption,
  StatesByCountry,
} from "@/types/country-access";

/**
 * Helpers for Config → Countries. Lists are stored as ISO alpha-2 codes; the
 * page always shows the country's name, with the code beside it for anyone
 * cross-checking a provider's sheet.
 */

/** The flag emoji for an alpha-2 code, or "" for anything else. */
export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

/**
 * Other names admins search by. The catalog uses current official short
 * names ("Türkiye", "Czech Republic"), and a provider's sheet or a ticket
 * often says something else.
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  AE: ["UAE", "Emirates"],
  BA: ["Bosnia"],
  CD: ["DRC", "Congo-Kinshasa"],
  CG: ["Congo-Brazzaville"],
  CI: ["Côte d'Ivoire", "Cote d'Ivoire"],
  CV: ["Cape Verde"],
  CZ: ["Czechia"],
  GB: ["UK", "Britain", "England", "Scotland", "Wales"],
  KP: ["DPRK"],
  KR: ["Korea"],
  MK: ["Macedonia"],
  MM: ["Burma"],
  NL: ["Holland"],
  PS: ["West Bank", "Gaza"],
  SZ: ["Swaziland"],
  TL: ["East Timor"],
  TR: ["Turkey", "Turkiye"],
  US: ["USA", "America"],
  VA: ["Holy See"],
};

/**
 * Search terms for a country besides its name and code: known aliases, and
 * the name without accents so "turk" finds "Türkiye" and "cote" finds "Côte".
 */
export function countryKeywords(code: string, name: string): string[] {
  const plain = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return [...(COUNTRY_ALIASES[code] ?? []), ...(plain !== name ? [plain] : [])];
}

/** Whether a filter box's text finds this country (name, alias or code). */
export function matchesCountry(
  code: string,
  name: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (code.toLowerCase() === needle) return true;
  return [name, ...countryKeywords(code, name)].some((term) =>
    term.toLowerCase().includes(needle),
  );
}

/** Look up names by code; unknown codes read as themselves. */
export function makeCountryNamer(catalog: CountryOption[]) {
  const names = new Map(catalog.map((c) => [c.code, c.name]));
  return (code: string) => names.get(code) ?? code;
}

/** Codes sorted by the name an admin will scan for. */
export function sortByName(
  codes: readonly string[],
  nameOf: (code: string) => string,
): string[] {
  return [...codes].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
}

/** What `after` added to `before`, and what it took away. */
export function diffCodes(
  before: readonly string[],
  after: readonly string[],
): { added: string[]; removed: string[] } {
  const was = new Set(before);
  const now = new Set(after);
  return {
    added: after.filter((c) => !was.has(c)),
    removed: before.filter((c) => !now.has(c)),
  };
}

/** {@link diffCodes} per country, leaving out countries with no change. */
export function diffStates(
  before: StatesByCountry,
  after: StatesByCountry,
): { added: StatesByCountry; removed: StatesByCountry } {
  const added: StatesByCountry = {};
  const removed: StatesByCountry = {};
  for (const country of new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ])) {
    const diff = diffCodes(before[country] ?? [], after[country] ?? []);
    if (diff.added.length) added[country] = diff.added;
    if (diff.removed.length) removed[country] = diff.removed;
  }
  return { added, removed };
}

/** Total number of states across countries. */
export function countStates(states: StatesByCountry): number {
  return Object.values(states).reduce((sum, list) => sum + list.length, 0);
}

/** "Indonesia, Turkey and 3 more" — for summaries that must stay short. */
export function summarizeNames(names: string[], max = 4): string {
  if (names.length <= max) {
    return names.length <= 1
      ? (names[0] ?? "")
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** Human labels for the lists, used in confirmations and toasts. */
export const COUNTRY_LIST_LABELS: Record<CountryAccessListKey, string> = {
  wirex_card: "Wirex card",
  rain_card: "Rain card",
  rain_virtual_account: "Rain USD virtual account",
  transfi_prohibited: "TransFi cash deposits",
};

/**
 * Where a developer edits each provider. Didit questionnaires are linked to a
 * workflow in its console; Sumsub levels are edited in its dashboard. Neither
 * can be done safely from here — see the provider panel on each list.
 */
export const DIDIT_CONSOLE_URL = "https://business.didit.me";
export const SUMSUB_DASHBOARD_URL = "https://cockpit.sumsub.com";
