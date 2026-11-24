/**
 * Server-side check, for the portal's own route handlers (`app/api/**`), that
 * a request comes from a signed-in admin.
 *
 * The admins service already verifies Firebase tokens and the allowed email
 * domain, so the caller's bearer token is checked by asking it for a list any
 * signed-in admin may read. Only the local admins service in development; a
 * deployment without the variable refuses rather than asking localhost.
 */
const ADMIN_API_BASE_URL =
  process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:5009"
    : undefined);

export const isAdminRequest = async (
  authorization: string | null,
  label: string,
): Promise<boolean> => {
  if (!authorization?.startsWith("Bearer ")) return false;
  if (!ADMIN_API_BASE_URL) {
    console.error(`[${label}] NEXT_PUBLIC_ADMIN_API_BASE_URL is not set`);
    return false;
  }

  try {
    const response = await fetch(`${ADMIN_API_BASE_URL}/admin/v1/whats-new`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error(`[${label}] Admin check failed:`, error);
    return false;
  }
};
