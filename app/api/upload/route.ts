import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-request";
import {
  detectImageType,
  UPLOAD_IMAGE_MAX_BYTES,
  UPLOAD_IMAGE_TYPES,
} from "@/lib/upload-limits";

/**
 * Stores an image an admin uploads (promotion banners, What's New images and
 * posters, AI model logos, push images) on Vercel Blob and returns its public
 * URL.
 *
 * Only signed-in admins may upload, and only images under the size Vercel lets
 * a route body carry: the files are public once stored, so an open endpoint
 * was free public hosting for anyone who found it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isAdminRequest(request.headers.get("authorization"), "upload"))) {
    return NextResponse.json(
      { error: "Sign in as an admin to upload files" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "Filename is required" }, { status: 400 });
  }

  const contentType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!UPLOAD_IMAGE_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, GIF, AVIF or SVG images can be uploaded" },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > UPLOAD_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "The file is too large" }, { status: 413 });
  }

  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }
  if (body.byteLength > UPLOAD_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "The file is too large" }, { status: 413 });
  }

  // The declared type comes from the file name; the bytes must be an image
  // too. It is stored as the type found, so a mislabelled image still works.
  const detectedType = detectImageType(new Uint8Array(body));
  if (!detectedType) {
    return NextResponse.json(
      { error: "The file is not a PNG, JPEG, WebP, GIF, AVIF or SVG image" },
      { status: 415 },
    );
  }

  try {
    const blob = await put(filename, body, {
      access: "public",
      addRandomSuffix: true,
      contentType: detectedType,
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error("[upload] Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
