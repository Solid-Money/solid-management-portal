// --- Config → Countries ----------------------------------------------------

/**
 * The lists Config → Countries edits. Each is the live gate for new sign-ups:
 *
 *  - `wirex_card` — countries the Wirex card takes new applicants from
 *    (verified by Sumsub).
 *  - `rain_card` — countries (and US states) the Rain card takes, verified by
 *    Didit, whose card questionnaire offers the same list.
 *  - `rain_virtual_account` — the Rain USD account, with its own Didit
 *    questionnaire.
 *  - `transfi_prohibited` — where TransFi's cash deposits and cash-outs are
 *    hidden in the app.
 */
export type CountryAccessListKey =
  | "wirex_card"
  | "rain_card"
  | "rain_virtual_account"
  | "transfi_prohibited";

/** Stored as ISO 3166-1 alpha-2; `name` is what the dashboard shows. */
export interface CountryOption {
  code: string;
  name: string;
}

/** Per country, the states it is limited to: `{ US: ['Alabama', …] }`. */
export type StatesByCountry = Record<string, string[]>;

/** A country a list cannot take, or one routing ignores on it, and why. */
export interface CountryAccessNote {
  code: string;
  reason: string;
}

/**
 * Where the provider side stands — the Didit questionnaire for the Rain
 * lists, the Sumsub level for Wirex. ISO timestamps.
 */
export interface CountryAccessProviderSync {
  outOfSync: boolean;
  /** Generated here, waiting to be linked to the Didit workflow. */
  questionnaireUuid?: string;
  questionnaireCreatedAt?: string;
  questionnaireCreatedBy?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  /** Read back from the Didit workflow, or an admin's word for it. */
  confirmedVia?: "didit_workflow" | "manual";
}

export type CountryAccessHistoryAction =
  | "updated"
  | "reset_to_defaults"
  | "questionnaire_created"
  | "provider_confirmed";

export interface CountryAccessHistoryEntry {
  /** ISO timestamp. */
  at: string;
  by: string;
  action: CountryAccessHistoryAction;
  addedCountries?: string[];
  removedCountries?: string[];
  addedStates?: StatesByCountry;
  removedStates?: StatesByCountry;
  questionnaireUuid?: string;
  note?: string;
}

/** What has to happen outside our database for an added country to go live. */
export interface CountryAccessProviderInfo {
  kind: "didit" | "sumsub" | "none";
  /** The Didit workflow whose questionnaire offers the list. */
  workflowId?: string;
  /** The Sumsub level Wirex applicants verify against. */
  levelName?: string;
  canGenerateQuestionnaire: boolean;
  canVerifyLink: boolean;
}

export interface CountryAccessList {
  key: CountryAccessListKey;
  /** False when the list has never been written in this environment. */
  exists: boolean;
  /** A disabled list serves nobody, whatever it holds. */
  isEnabled: boolean;
  countries: string[];
  states: StatesByCountry;
  supportsStates: boolean;
  /** What "Reset to code defaults" would write; null when there is none. */
  defaults: { countries: string[]; states: StatesByCountry } | null;
  /** Added since the provider was last confirmed — not live for users yet. */
  pendingCountries: string[];
  pendingStates: StatesByCountry;
  providerSync: CountryAccessProviderSync | null;
  provider: CountryAccessProviderInfo;
  /** Countries that cannot be added to this list. */
  blocked: CountryAccessNote[];
  /** Countries on this list that routing sends elsewhere anyway. */
  overridden: CountryAccessNote[];
  /** Sent back with an edit, so a stale save is refused. */
  updatedAt: string | null;
  updatedBy: string | null;
  /** Newest first. */
  history: CountryAccessHistoryEntry[];
}

export interface CountryAccessOverview {
  catalog: CountryOption[];
  stateCatalog: Record<string, string[]>;
  environment: {
    wirexCardEnabled: boolean;
    wirexVirtualAccountEnabled: boolean;
    wirexTeamOnly: boolean;
    qaOnlyCountries: string[];
  };
  lists: Record<CountryAccessListKey, CountryAccessList>;
  /** Code-held lists, shown read-only. */
  reference: {
    wirexSepa: string[];
    wirexAch: string[];
    sumsubOnramp: string[];
    rainVaRestricted: string[];
    wirexClosed: string[];
  };
}

export interface UpdateCountryAccessListRequest {
  countries: string[];
  states?: StatesByCountry;
  expectedUpdatedAt?: string;
  note?: string;
}

export interface CreatedDiditQuestionnaire {
  questionnaireUuid: string;
  workflowId: string;
  list: CountryAccessList;
}

export interface DiditLinkCheck {
  linked: boolean;
  expectedQuestionnaireUuid: string;
  workflowId: string;
  workflowLabel?: string;
  foundQuestionnaireUuids: string[];
  list: CountryAccessList;
}
