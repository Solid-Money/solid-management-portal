import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { VIDEO_MAX_BYTES, VIDEO_TYPE } from "@/lib/whats-new";

const ADMIN_API_BASE_URL =
  process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL || "http://localhost:5009";

/** Every What's New video is stored under this prefix. */
const VIDEO_PATH_PREFIX = "whats-new/";

/**
 * Whether the request comes from a signed-in admin. The admins service already
 * verifies Firebase tokens and the allowed email domain, so the token is
 * checked by asking it for the very list this video is uploaded for.
 */
const isAdmin = async (authorization: string | null): Promise<boolean> => {
  if (!authorization?.startsWith("Bearer ")) return false;

  try {
    const response = await fetch(`${ADMIN_API_BASE_URL}/admin/v1/whats-new`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error("[whats-new/video-upload] Admin check failed:", error);
    return false;
  }
};

/**
 * Hands the browser a short-lived token to upload a What's New video straight
 * to Vercel Blob. `/api/upload` streams files through this server, which
 * Vercel caps at about 4.5 MB; videos go up to 20 MB.
 *
 * Only signed-in admins get a token, and only for an MP4 of 20 MB or less.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(VIDEO_PATH_PREFIX)) {
          throw new Error("Videos are uploaded under whats-new/");
        }
        if (!(await isAdmin(request.headers.get("authorization")))) {
          throw new Error("Sign in as an admin to upload videos");
        }

        return {
          allowedContentTypes: [VIDEO_TYPE],
          maximumSizeInBytes: VIDEO_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[whats-new/video-upload] Upload refused:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
