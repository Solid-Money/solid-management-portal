import { upload } from "@vercel/blob/client";

import { auth } from "@/lib/firebase";

/**
 * Browser-only helpers for What's New media: read an upload's size and length
 * before it leaves the machine, make a video's poster from its first frame,
 * and upload both.
 */

const loadEvent = (
  target: HTMLMediaElement | HTMLImageElement,
  event: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The browser could not read this file."));
    };
    const cleanup = () => {
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });

/** Pixel size of an image file. */
export const readImageSize = async (
  file: File,
): Promise<{ width: number; height: number }> => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    const loaded = loadEvent(image, "load");
    image.src = url;
    await loaded;
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};

export interface VideoFacts {
  width: number;
  height: number;
  durationSec: number;
  /** A JPG of the first frame. */
  poster: Blob;
}

/** Pixel size, length and first-frame poster of an MP4 file. */
export const readVideo = async (file: File): Promise<VideoFacts> => {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const metadata = loadEvent(video, "loadeddata");
    video.src = url;
    await metadata;

    // A tiny seek makes Safari paint the first frame before it is drawn.
    if (video.duration > 0) {
      const seeked = loadEvent(video, "seeked");
      video.currentTime = 0.001;
      await seeked;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) {
      throw new Error("The browser could not read this video's frames.");
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const poster = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not make a poster from the video.")),
        "image/jpeg",
        0.85,
      ),
    );

    return {
      width: video.videoWidth,
      height: video.videoHeight,
      durationSec: video.duration,
      poster,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** `swap launch.mp4` → `swap-launch`, safe for a blob path. */
const baseName = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "whats-new";

/** Images and posters: through `/api/upload`, as the carousel always has. */
export const uploadImage = async (
  file: Blob,
  fileName: string,
): Promise<string> => {
  const response = await fetch(
    `/api/upload?filename=${encodeURIComponent(fileName)}`,
    { method: "POST", body: file },
  );
  if (!response.ok) throw new Error("Failed to upload image");
  const blob = (await response.json()) as { url: string };
  return blob.url;
};

export const uploadPoster = (poster: Blob, videoFileName: string) =>
  uploadImage(poster, `${baseName(videoFileName)}-poster.jpg`);

/**
 * Videos: straight from the browser to Vercel Blob, with a token from
 * `/api/whats-new/video-upload`.
 */
export const uploadVideo = async (
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<string> => {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in again to upload videos.");

  const blob = await upload(`whats-new/${baseName(file.name)}.mp4`, file, {
    access: "public",
    handleUploadUrl: "/api/whats-new/video-upload",
    headers: { Authorization: `Bearer ${token}` },
    contentType: "video/mp4",
    multipart: file.size > 5 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress?.(percentage),
  });
  return blob.url;
};
