"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Film, ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import WhatsNewPreview from "@/components/whats-new-preview";
import { Switch } from "@/components/ui/switch";
import {
  IMAGE_TYPES,
  isValidWhatsNewLink,
  mediaWarnings,
  RECOMMENDED_HEIGHT,
  RECOMMENDED_WIDTH,
  type MediaFacts,
  type SingleFormState,
  VIDEO_MAX_BYTES,
  VIDEO_TYPE,
} from "@/lib/whats-new";
import {
  readImageSize,
  readVideo,
  uploadImage,
  uploadPoster,
  uploadVideo,
} from "@/lib/whats-new-media";
import type { WhatsNewPresentation } from "@/types";

interface WhatsNewSingleFormProps {
  form: SingleFormState;
  onChange: (next: Partial<SingleFormState>) => void;
  showErrors: boolean;
  /** True while a file is uploading, so the modal can hold the Save button. */
  onUploadingChange: (uploading: boolean) => void;
}

const SHOW_AS_OPTIONS: { value: WhatsNewPresentation; label: string }[] = [
  { value: "popup", label: "Popup" },
  { value: "drawer", label: "Bottom drawer" },
];

const inputClass = (invalid: boolean) =>
  `w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
    invalid ? "border-red-300 bg-red-50" : "border-gray-300"
  }`;

/**
 * The "Single image or video" half of the What's New form: one image or one
 * MP4, how it shows on a phone, its alt text and an optional link, with a
 * live phone and desktop preview beside it.
 */
export default function WhatsNewSingleForm({
  form,
  onChange,
  showErrors,
  onUploadingChange,
}: WhatsNewSingleFormProps) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  // Size and type of what was uploaded this session, for the guideline
  // warnings. Media saved earlier only has what the backend stores.
  const [facts, setFacts] = useState<MediaFacts | null>(() =>
    form.media
      ? {
          type: form.media.type,
          width: form.media.width,
          height: form.media.height,
          durationSec: form.media.durationSec,
        }
      : null
  );
  const [busy, setBusy] = useState<"media" | "poster" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const { media } = form;
  const warnings = facts ? mediaWarnings(facts, form.presentation) : [];
  const linkInvalid = !isValidWhatsNewLink(form.link);

  const setBusyState = (next: "media" | "poster" | null) => {
    setBusy(next);
    onUploadingChange(next !== null);
    if (next === null) setProgress(null);
  };

  const handleMediaFile = async (file: File) => {
    const isVideo = file.type.startsWith("video/");

    if (isVideo && file.type !== VIDEO_TYPE) {
      toast.error("Videos must be MP4 (H.264 + AAC).");
      return;
    }
    if (isVideo && file.size > VIDEO_MAX_BYTES) {
      toast.error("Videos can be 20 MB at most.");
      return;
    }
    if (!isVideo && !file.type.startsWith("image/")) {
      toast.error("Upload an image or an MP4 video.");
      return;
    }

    setBusyState("media");
    try {
      if (isVideo) {
        const video = await readVideo(file);
        const posterUrl = await uploadPoster(video.poster, file.name);
        const url = await uploadVideo(file, setProgress);
        onChange({
          media: {
            type: "video",
            url,
            width: video.width,
            height: video.height,
            durationSec: video.durationSec,
            posterUrl,
            hasAudio: media?.type === "video" ? !!media.hasAudio : false,
            alt: media?.alt ?? "",
          },
        });
        setFacts({
          type: "video",
          width: video.width,
          height: video.height,
          durationSec: video.durationSec,
          sizeBytes: file.size,
          mimeType: file.type,
        });
      } else {
        const size = await readImageSize(file);
        const url = await uploadImage(file, file.name);
        onChange({
          media: {
            type: "image",
            url,
            width: size.width,
            height: size.height,
            alt: media?.alt ?? "",
          },
        });
        setFacts({
          type: "image",
          ...size,
          sizeBytes: file.size,
          mimeType: file.type,
        });
      }
      toast.success(`${isVideo ? "Video" : "Image"} uploaded`);
    } catch (error) {
      console.error("What's New media upload failed:", error);
      toast.error((error as Error).message || "Upload failed.");
    } finally {
      setBusyState(null);
    }
  };

  const handlePosterFile = async (file: File) => {
    if (!media || media.type !== "video") return;
    setBusyState("poster");
    try {
      const posterUrl = await uploadImage(file, file.name);
      onChange({ media: { ...media, posterUrl } });
      toast.success("Poster replaced");
    } catch (error) {
      console.error("Poster upload failed:", error);
      toast.error("Failed to upload poster.");
    } finally {
      setBusyState(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="space-y-1">
          <label
            htmlFor="whats-new-name"
            className="text-sm font-medium text-gray-700"
          >
            Internal name
          </label>
          <input
            id="whats-new-name"
            type="text"
            value={form.name}
            maxLength={120}
            onChange={(e) => onChange({ name: e.target.value })}
            className={inputClass(showErrors && !form.name.trim())}
            placeholder="e.g. Swap v1 launch"
          />
          <p className="text-xs text-gray-500">
            Only admins see it. Used in this list and in analytics.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700">Show as</span>
          <div
            role="radiogroup"
            aria-label="Show as"
            className="inline-flex rounded-md border border-gray-300 p-0.5"
          >
            {SHOW_AS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={form.presentation === option.value}
                onClick={() => onChange({ presentation: option.value })}
                className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.presentation === option.value
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Desktop always shows a popup.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700">Media</span>
          <div
            className={`flex items-center gap-4 rounded-lg border-2 border-dashed p-4 ${
              showErrors && !media
                ? "border-red-300 bg-red-50"
                : "border-gray-300 bg-gray-50"
            }`}
          >
            <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-200 text-gray-400">
              {media ? (
                // eslint-disable-next-line @next/next/no-img-element -- thumbnail of an arbitrary upload
                <img
                  src={
                    media.type === "video" ? media.posterUrl ?? "" : media.url
                  }
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {media ? (
                <p className="flex items-center gap-1.5 text-sm text-gray-700">
                  {media.type === "video" ? (
                    <Film className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-gray-400" />
                  )}
                  {media.type === "video" ? "Video" : "Image"} · {media.width} ×{" "}
                  {media.height}
                  {media.type === "video" && media.durationSec !== undefined
                    ? ` · ${media.durationSec.toFixed(1)} s`
                    : ""}
                </p>
              ) : (
                <p className="text-sm text-gray-700">
                  One image (PNG, JPG or WebP, up to 1 MB) or one MP4 (up to
                  60 s, 20 MB).
                </p>
              )}
              <p className="text-xs text-gray-500">
                Recommended {RECOMMENDED_WIDTH} × {RECOMMENDED_HEIGHT} (4:5).
                Put any words inside the media, clear of the top-right corner.
              </p>
              {busy === "media" && progress !== null && (
                <div className="h-1.5 w-full overflow-hidden rounded bg-gray-200">
                  <div
                    className="h-full bg-indigo-600 transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => mediaInputRef.current?.click()}
              className="inline-flex shrink-0 cursor-pointer items-center rounded-md bg-indigo-100 px-3 py-1.5 text-sm text-indigo-700 transition-colors hover:bg-indigo-200 disabled:opacity-50"
            >
              {busy === "media" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              {media ? "Replace" : "Upload"}
            </button>
          </div>

          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-md bg-amber-50 p-3">
              {warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-1.5 text-xs text-amber-800"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>

        {media?.type === "video" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Poster</span>
              <p className="text-xs text-gray-500">
                Made from the first frame. Shown until the video starts, and
                instead of it if it can&apos;t play.
              </p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => posterInputRef.current?.click()}
                className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === "poster" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                Replace poster
              </button>
            </div>
            <div className="space-y-1">
              <span
                id="whats-new-has-sound"
                className="text-sm font-medium text-gray-700"
              >
                Has sound
              </span>
              <p className="text-xs text-gray-500">
                On: the app shows a sound button. Sound stays off until tapped.
              </p>
              <Switch
                aria-labelledby="whats-new-has-sound"
                checked={!!media.hasAudio}
                onCheckedChange={(hasAudio) =>
                  onChange({ media: { ...media, hasAudio } })
                }
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label
            htmlFor="whats-new-alt"
            className="text-sm font-medium text-gray-700"
          >
            Alt text
          </label>
          <input
            id="whats-new-alt"
            type="text"
            value={media?.alt ?? ""}
            disabled={!media}
            maxLength={300}
            onChange={(e) =>
              media && onChange({ media: { ...media, alt: e.target.value } })
            }
            className={inputClass(showErrors && !!media && !media.alt.trim())}
            placeholder="One sentence of what the media says"
          />
          <p className="text-xs text-gray-500">Read out by screen readers.</p>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="whats-new-link"
            className="text-sm font-medium text-gray-700"
          >
            Link <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="whats-new-link"
            type="text"
            value={form.link}
            onChange={(e) => onChange({ link: e.target.value })}
            className={inputClass(linkInvalid)}
            placeholder="/rewards or https://..."
          />
          {linkInvalid ? (
            <p className="text-xs text-red-600">
              The link must start with / (an app screen) or https://
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Tapping the media closes it and opens this. No link: tapping does
              nothing.
            </p>
          )}
        </div>
      </div>

      <WhatsNewPreview media={media} shownAs={form.presentation} />

      <input
        ref={mediaInputRef}
        type="file"
        className="hidden"
        accept={[...IMAGE_TYPES, VIDEO_TYPE].join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleMediaFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={posterInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePosterFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
