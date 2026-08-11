import { NextResponse } from 'next/server';

import { LatestAppVersion } from '@/types';

const GITHUB_OWNER = 'Solid-Money';
const GITHUB_REPO = 'solid-ui';
const IOS_BUNDLE_ID = 'app.solid.xyz';

// `version` in solid-ui's app.config.ts is the native version Expo bakes into
// the binary, which is exactly what `Application.nativeApplicationVersion`
// reports back on device — so it is the value a version-gated banner is
// compared against.
const APP_CONFIG_VERSION_PATTERN =
  /^\s*version:\s*['"](\d+(?:\.\d+){0,2})['"]/m;

// The production dashboard gates banners against the app built from master; the
// staging dashboard against qa. Override with SOLID_UI_BRANCH when a release is
// cut from somewhere else.
const branchForEnvironment = (): string =>
  process.env.SOLID_UI_BRANCH ||
  (process.env.VERCEL_ENV === 'production' ? 'master' : 'qa');

// Revalidate the whole route rather than fetching per request: every admin
// hitting the banner form shares one cached lookup, which keeps the dashboard
// well clear of GitHub's unauthenticated rate limit.
export const revalidate = 600;

const fetchVersionFromGithub = async (branch: string): Promise<string> => {
  // solid-ui is a public repo, so raw.githubusercontent.com needs no token.
  const response = await fetch(
    `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${branch}/app.config.ts`,
    { headers: { Accept: 'text/plain' }, next: { revalidate } },
  );

  if (!response.ok) {
    throw new Error(
      `raw.githubusercontent.com responded ${response.status} for branch "${branch}"`,
    );
  }

  const version = APP_CONFIG_VERSION_PATTERN.exec(await response.text())?.[1];

  if (!version) {
    throw new Error('No version field found in app.config.ts');
  }

  return version;
};

// Fallback for when GitHub is unreachable or app.config.ts moves its version
// field. Note this is the version currently *live on the App Store*, which
// trails master whenever a release is in review.
const fetchVersionFromAppStore = async (): Promise<string> => {
  const response = await fetch(
    `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`,
    { next: { revalidate } },
  );

  if (!response.ok) {
    throw new Error(`itunes.apple.com responded ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: { version?: string }[];
  };
  const version = payload.results?.[0]?.version;

  if (!version) {
    throw new Error(`No App Store listing found for ${IOS_BUNDLE_ID}`);
  }

  return version;
};

export async function GET(): Promise<NextResponse> {
  const branch = branchForEnvironment();

  try {
    return NextResponse.json<LatestAppVersion>({
      version: await fetchVersionFromGithub(branch),
      branch,
      source: 'github',
    });
  } catch (error) {
    console.error('[app-version] GitHub lookup failed:', error);
  }

  try {
    return NextResponse.json<LatestAppVersion>({
      version: await fetchVersionFromAppStore(),
      branch: null,
      source: 'app-store',
    });
  } catch (error) {
    console.error('[app-version] App Store lookup failed:', error);
    return NextResponse.json(
      { error: 'Could not determine the latest app version' },
      { status: 502 },
    );
  }
}
