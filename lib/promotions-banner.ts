import { LatestAppVersion } from "@/types";

/**
 * A version gate is a semver version optionally prefixed with a comparator:
 * ">=2.0.0" targets that build and every newer one, "1.0.12" only that build.
 * Kept in sync with PROMOTIONS_BANNER_VERSION_REGEX in solid-backend.
 */
export const VERSION_GATE_PATTERN = /^(?:>=|<=|>|<|=)?\d+(?:\.\d+){0,2}$/;

/** Kept in sync with PROMOTIONS_BANNER_PAGE_REGEX in solid-backend. */
export const PAGE_PATH_PATTERN = /^(?:\/|(?:\/[A-Za-z0-9\-_]+)+)$/;

/** ">= 2.0.0" is the same gate as ">=2.0.0" — admins type it either way. */
export const normalizeVersionGate = (value: string): string =>
  value.replace(/\s+/g, "");

/**
 * Turn what an admin types ("savings", "/savings", "/savings/") into the single
 * pathname the app compares against. Mirrors the backend's normalisation so the
 * value previewed in the form is the value that gets stored.
 */
export const normalizePagePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  // Drop a trailing slash so "/savings/" and "/savings" are one page, but keep
  // the root "/" as-is.
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, "")
    : withLeadingSlash;
};

/** Both fields are optional, so an empty value is always valid. */
export const isValidVersionGate = (value: string): boolean =>
  !normalizeVersionGate(value) ||
  VERSION_GATE_PATTERN.test(normalizeVersionGate(value));

export const isValidPagePath = (value: string): boolean =>
  !normalizePagePath(value) || PAGE_PATH_PATTERN.test(normalizePagePath(value));

export const fetchLatestAppVersion = async (): Promise<LatestAppVersion> => {
  const response = await fetch("/api/app-version");

  if (!response.ok) {
    throw new Error(`Failed to look up the latest app version (${response.status})`);
  }

  return response.json();
};
