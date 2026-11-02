import type { AdminRank, PasskeyAttestation } from "@/types/admin-access";

/**
 * Approval signing in the browser: the admin's passkey talks to Turnkey
 * directly, never through our backend, which only ever sees the result.
 *
 * Passkeys are bound to the portal's domain. The SDK is loaded on first use,
 * so it is never part of a server render.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL || "https://api.turnkey.com";

const rpId = () =>
  process.env.NEXT_PUBLIC_TURNKEY_RP_ID || window.location.hostname;

/** The Turnkey user name an admin has in the admin sub-org. */
export const turnkeyAdminUserName = (email: string) => `solid-admin:${email}`;

async function passkeyClient(organizationId: string) {
  const { Turnkey } = await import("@turnkey/sdk-browser");
  return new Turnkey({
    apiBaseUrl: API_BASE_URL,
    defaultOrganizationId: organizationId,
    rpId: rpId(),
  }).passkeyClient();
}

/** Turnkey's activity, when a call returns one rather than a result. */
type ActivityResponse = { activity?: { id: string; status: string } };

const statusOf = (response: unknown) =>
  (response as ActivityResponse).activity?.status;

/**
 * Make a new passkey for approval signing on this device. Nothing is sent to
 * Turnkey yet: the backend keeps it until it is added to the admin sub-org.
 */
export async function createSigningPasskey(
  email: string,
  name?: string
): Promise<{ challenge: string; attestation: PasskeyAttestation }> {
  const client = await passkeyClient("unused");
  const { encodedChallenge, attestation } = await client.createUserPasskey({
    publicKey: {
      rp: { name: "Solid Admin approvals" },
      user: { name: email, displayName: name ?? email },
    },
  });
  return { challenge: encodedChallenge, attestation };
}

/**
 * Sign an approval message with the approval wallet, as yourself. Turnkey
 * signs only for a ranked admin, after your passkey prompt; the activity id
 * is what the backend checks.
 */
export async function signApprovalMessage(input: {
  subOrganizationId: string;
  walletAddress: string;
  message: string;
}): Promise<string> {
  const client = await passkeyClient(input.subOrganizationId);
  const response = await client.signRawPayload({
    organizationId: input.subOrganizationId,
    signWith: input.walletAddress,
    payload: input.message,
    encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
    hashFunction: "HASH_FUNCTION_KECCAK256",
  });
  const activity = (response as ActivityResponse).activity;
  if (!activity || activity.status !== "ACTIVITY_STATUS_COMPLETED") {
    throw new Error(
      activity
        ? `Turnkey did not sign (${activity.status.replace("ACTIVITY_STATUS_", "").toLowerCase()})`
        : "Turnkey did not sign"
    );
  }
  return activity.id;
}

/**
 * Root admins: start a root action in the admin sub-org. With a quorum of
 * two it waits for a second root admin, so this returns whether it is done
 * or waiting.
 */
type RootActionResult = "done" | "waiting";

const rootResult = (response: unknown): RootActionResult => {
  const status = statusOf(response);
  if (status === "ACTIVITY_STATUS_COMPLETED") return "done";
  if (status === "ACTIVITY_STATUS_CONSENSUS_NEEDED") return "waiting";
  throw new Error(
    `Turnkey refused it (${(status ?? "unknown").replace("ACTIVITY_STATUS_", "").toLowerCase()})`
  );
};

/** Add an admin, with their saved passkey and rank tag. */
export async function addAdminInTurnkey(input: {
  subOrganizationId: string;
  email: string;
  rankTagId: string;
  challenge: string;
  attestation: PasskeyAttestation;
}): Promise<RootActionResult> {
  const client = await passkeyClient(input.subOrganizationId);
  return rootResult(
    await client.createUsers({
      organizationId: input.subOrganizationId,
      users: [
        {
          userName: turnkeyAdminUserName(input.email),
          apiKeys: [],
          authenticators: [
            {
              authenticatorName: "Solid portal passkey",
              challenge: input.challenge,
              attestation: input.attestation,
            },
          ],
          oauthProviders: [],
          userTags: [input.rankTagId],
        },
      ],
    })
  );
}

/** Add a new passkey to an admin already in the sub-org (a new device). */
export async function addPasskeyInTurnkey(input: {
  subOrganizationId: string;
  userId: string;
  challenge: string;
  attestation: PasskeyAttestation;
}): Promise<RootActionResult> {
  const client = await passkeyClient(input.subOrganizationId);
  return rootResult(
    await client.createAuthenticators({
      organizationId: input.subOrganizationId,
      userId: input.userId,
      authenticators: [
        {
          authenticatorName: "Solid portal passkey",
          challenge: input.challenge,
          attestation: input.attestation,
        },
      ],
    })
  );
}

/** Set an admin's rank tag in Turnkey to match their rank here. */
export async function setRankInTurnkey(input: {
  subOrganizationId: string;
  userId: string;
  rank: AdminRank;
  tagIds: Partial<Record<AdminRank, string>>;
}): Promise<RootActionResult> {
  const tagId = input.tagIds[input.rank];
  if (!tagId) throw new Error(`Turnkey has no rank ${input.rank} tag`);
  const client = await passkeyClient(input.subOrganizationId);
  return rootResult(
    await client.updateUser({
      organizationId: input.subOrganizationId,
      userId: input.userId,
      userTagIds: [tagId],
    })
  );
}

/** Take an admin out of approval signing. */
export async function removeFromTurnkey(input: {
  subOrganizationId: string;
  userId: string;
}): Promise<RootActionResult> {
  const client = await passkeyClient(input.subOrganizationId);
  return rootResult(
    await client.deleteUsers({
      organizationId: input.subOrganizationId,
      userIds: [input.userId],
    })
  );
}

/** Give the second root approval to a waiting root action. */
export async function approveInTurnkey(input: {
  subOrganizationId: string;
  fingerprint: string;
}): Promise<RootActionResult> {
  const client = await passkeyClient(input.subOrganizationId);
  return rootResult(
    await client.approveActivity({
      organizationId: input.subOrganizationId,
      fingerprint: input.fingerprint,
    })
  );
}
