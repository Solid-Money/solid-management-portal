import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-request";
import { VIDEO_MAX_BYTES, VIDEO_TYPE } from "@/lib/whats-new";

/** Every What's New video is stored under this prefix. */
const VIDEO_PATH_PREFIX = "whats-new/";

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
        if (
          !(await isAdminRequest(
            request.headers.get("authorization"),
            "whats-new/video-upload",
          ))
        ) {
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
