import type {
  WhatsNew,
  WhatsNewMedia,
  WhatsNewMediaType,
  WhatsNewPresentation,
} from "@/types";

/**
 * Where tapping the media goes: an in-app route (`/rewards`) or a web page
 * (`https://…`). `//` and `/\` are refused because browsers read both as a
 * link to another site. Kept in sync with WHATS_NEW_LINK_PATTERN in
 * solid-backend.
 */
export const WHATS_NEW_LINK_PATTERN = /^(\/(?![/\\])|https:\/\/)\S*$/;

/** The link is optional, so blank is valid. */
export const isValidWhatsNewLink = (value: string): boolean =>
  !value.trim() || WHATS_NEW_LINK_PATTERN.test(value.trim());

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const VIDEO_TYPE = "video/mp4";

/** Hard limit: the upload route refuses anything bigger. */
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const VIDEO_TARGET_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 60;
const IMAGE_MAX_BYTES = 1024 * 1024;
/** 1080 × 1350 (4:5) is the recommended size for both. */
export const RECOMMENDED_WIDTH = 1080;
export const RECOMMENDED_HEIGHT = 1350;

/**
 * Allowed height ÷ width per presentation. A popup takes 1:1 to 9:16, a drawer
 * 1:1 to 4:5: it is full width, so anything taller would push past the top.
 */
export const RATIO_LIMITS: Record<
  WhatsNewPresentation,
  { min: number; max: number; label: string }
> = {
  popup: { min: 1, max: 16 / 9, label: "1:1 to 9:16" },
  drawer: { min: 1, max: 5 / 4, label: "1:1 to 4:5" },
};

const RATIO_TOLERANCE = 0.01;

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export interface MediaFacts {
  type: WhatsNewMediaType;
  width: number;
  height: number;
  /** Absent for media saved earlier, whose file size we no longer know. */
  sizeBytes?: number;
  mimeType?: string;
  durationSec?: number;
}

/**
 * What doesn't match the media guidelines. These are warnings, not errors: the
 * admin can still save. Nothing here repeats a hard limit the upload already
 * enforces.
 */
export const mediaWarnings = (
  media: MediaFacts,
  presentation: WhatsNewPresentation,
): string[] => {
  const warnings: string[] = [];
  const ratio = media.height / media.width;
  const limits = RATIO_LIMITS[presentation];

  if (
    ratio < limits.min - RATIO_TOLERANCE ||
    ratio > limits.max + RATIO_TOLERANCE
  ) {
    warnings.push(
      `${media.width} × ${media.height} is outside the ${limits.label} a ${
        presentation === "popup" ? "popup" : "drawer"
      } allows. The app still shows it whole, but it will look ${
        ratio < limits.min ? "short and wide" : "very tall"
      }.`,
    );
  }

  if (media.width < RECOMMENDED_WIDTH) {
    warnings.push(
      `${media.width}px wide is under the recommended ${RECOMMENDED_WIDTH}px, so it may look soft on large phones.`,
    );
  }

  if (media.type === "image") {
    if (media.mimeType && !IMAGE_TYPES.includes(media.mimeType)) {
      warnings.push(
        media.mimeType === "image/gif"
          ? "Animated GIFs stall on iOS. Upload an MP4 video instead."
          : "Use PNG, JPG or WebP.",
      );
    }
    if (media.sizeBytes !== undefined && media.sizeBytes > IMAGE_MAX_BYTES) {
      warnings.push(
        `${megabytes(media.sizeBytes)} is over the 1 MB guideline, so it will be slower to appear.`,
      );
    }
  } else {
    if (
      media.durationSec !== undefined &&
      media.durationSec > VIDEO_MAX_SECONDS
    ) {
      warnings.push(
        `${Math.round(media.durationSec)} s is over the 60 s guideline.`,
      );
    }
    if (
      media.sizeBytes !== undefined &&
      media.sizeBytes > VIDEO_TARGET_BYTES
    ) {
      warnings.push(
        `${megabytes(media.sizeBytes)}: aim for under 8 MB so it starts quickly on mobile data.`,
      );
    }
  }

  return warnings;
};

/** The name shown in the list: the internal name, else step 1's title. */
export const whatsNewDisplayName = (popup: WhatsNew): string =>
  popup.name?.trim() || popup.steps[0]?.title?.trim() || "No title";

export const isSinglePopup = (popup: WhatsNew): boolean =>
  popup.format === "single" && !!popup.media;

/** `Image · Popup`, `Video · Drawer`, `Steps · 3`. */
export const whatsNewBadge = (popup: WhatsNew): string => {
  if (isSinglePopup(popup)) {
    const kind = popup.media?.type === "video" ? "Video" : "Image";
    const shownAs = popup.presentation === "drawer" ? "Drawer" : "Popup";
    return `${kind} · ${shownAs}`;
  }
  return `Steps · ${popup.steps.length}`;
};

/** List thumbnail: a video's poster, the image, or step 1's image. */
export const whatsNewThumbnail = (popup: WhatsNew): string | undefined => {
  if (isSinglePopup(popup)) {
    return popup.media?.type === "video"
      ? popup.media.posterUrl
      : popup.media?.url;
  }
  return popup.steps[0]?.imageUrl || undefined;
};

export interface SingleFormState {
  name: string;
  presentation: WhatsNewPresentation;
  media: WhatsNewMedia | null;
  link: string;
  isActive: boolean;
  showOnLoad: boolean;
}

/** What's still missing before a single can be saved, in form order. */
export const singleFormErrors = (form: SingleFormState): string[] => {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Add an internal name.");
  if (!form.media) {
    errors.push("Upload an image or a video.");
  } else {
    if (form.media.type === "video" && !form.media.posterUrl) {
      errors.push("The video needs a poster.");
    }
    if (!form.media.alt.trim()) errors.push("Add alt text.");
  }
  if (!isValidWhatsNewLink(form.link)) {
    errors.push("The link must start with / or https://");
  }
  return errors;
};

/**
 * The body sent to `/admin/v1/whats-new` for a single. Video-only fields are
 * left off an image, and a blank link is sent blank so the backend clears it.
 */
export const singlePayload = (form: SingleFormState) => {
  if (!form.media) throw new Error("A single needs media");

  const { type, url, width, height, alt, posterUrl, durationSec, hasAudio } =
    form.media;

  const media: WhatsNewMedia = {
    type,
    url,
    width: Math.round(width),
    height: Math.round(height),
    alt: alt.trim(),
  };

  if (type === "video") {
    media.posterUrl = posterUrl;
    if (durationSec !== undefined) {
      media.durationSec = Math.round(durationSec * 10) / 10;
    }
    media.hasAudio = !!hasAudio;
  }

  return {
    format: "single" as const,
    name: form.name.trim(),
    presentation: form.presentation,
    media,
    link: form.link.trim(),
    isActive: form.isActive,
    showOnLoad: form.showOnLoad,
  };
};

export interface PreviewBox {
  width: number;
  height: number;
}

/**
 * The size the app draws a single at, scaled into a preview frame. Mirrors
 * the app's layout rules so the preview matches the phone:
 * - popup: min(screen − 32, 440) wide, height from the media's ratio, scaled
 *   down to fit 85% of the screen height;
 * - drawer: full width, scaled down to fit 90% of the screen height.
 */
export const singleMediaSize = (
  screen: PreviewBox,
  media: Pick<WhatsNewMedia, "width" | "height">,
  shownAs: WhatsNewPresentation,
): PreviewBox => {
  const ratio = media.height / media.width;
  const isDrawer = shownAs === "drawer";
  const maxWidth = isDrawer ? screen.width : Math.min(screen.width - 32, 440);
  const maxHeight = screen.height * (isDrawer ? 0.9 : 0.85);
  const width = Math.min(maxWidth, maxHeight / ratio);
  return { width, height: width * ratio };
};
