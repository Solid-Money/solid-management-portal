"use client";

import { Volume2, VolumeX, X } from "lucide-react";

import { singleMediaSize, type PreviewBox } from "@/lib/whats-new";
import type { WhatsNewMedia, WhatsNewPresentation } from "@/types";

/** Logical screen sizes the frames stand for, in the app's points. */
const PHONE: PreviewBox = { width: 390, height: 844 };
const DESKTOP: PreviewBox = { width: 1280, height: 800 };

/** How big each frame is drawn in the form. */
const PHONE_FRAME_WIDTH = 220;
const DESKTOP_FRAME_WIDTH = 320;

interface ScreenProps {
  screen: PreviewBox;
  frameWidth: number;
  media: WhatsNewMedia;
  shownAs: WhatsNewPresentation;
  frameClassName: string;
}

/**
 * One screen of the preview, drawn to the app's rules at a reduced scale:
 * backdrop black at 70%, media at its own ratio, 20pt corners on a popup and
 * 24pt top corners on a drawer, a 0 24 48 shadow at 50%, the 32pt close
 * button 12pt in from the top-right corner, and the sound button bottom-left.
 */
function PreviewScreen({
  screen,
  frameWidth,
  media,
  shownAs,
  frameClassName,
}: ScreenProps) {
  const scale = frameWidth / screen.width;
  const size = singleMediaSize(screen, media, shownAs);
  const isDrawer = shownAs === "drawer";
  const px = (value: number) => value * scale;
  const button = px(32);
  const inset = px(12);
  const radius = px(isDrawer ? 24 : 20);

  return (
    <div
      className={`relative overflow-hidden bg-[#111] ${frameClassName}`}
      style={{ width: frameWidth, height: screen.height * scale }}
    >
      {/* Stand-in for the screen underneath. */}
      <div className="absolute inset-0 space-y-2 p-3">
        <div className="h-3 w-1/3 rounded bg-white/15" />
        <div className="h-12 rounded-lg bg-white/10" />
        <div className="h-8 rounded-lg bg-white/10" />
        <div className="h-8 rounded-lg bg-white/10" />
      </div>
      <div className="absolute inset-0 bg-black/70" />

      <div
        className={`absolute flex ${
          isDrawer
            ? "inset-x-0 bottom-0 items-end justify-center"
            : "inset-0 items-center justify-center"
        }`}
      >
        <div
          className="relative overflow-hidden bg-black"
          style={{
            width: size.width * scale,
            height: size.height * scale,
            borderRadius: isDrawer ? `${radius}px ${radius}px 0 0` : radius,
            boxShadow: `0 ${px(24)}px ${px(48)}px rgba(0,0,0,0.5)`,
          }}
        >
          {media.type === "video" ? (
            <video
              key={media.url}
              src={media.url}
              poster={media.posterUrl}
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a live preview of an arbitrary upload, not a page asset
            <img
              src={media.url}
              alt={media.alt}
              className="h-full w-full object-cover"
            />
          )}

          {isDrawer && (
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/70"
              style={{ top: px(8), width: px(36), height: px(5) }}
            />
          )}

          <div
            className="absolute flex items-center justify-center rounded-full bg-black/50 text-white"
            style={{ top: inset, right: inset, width: button, height: button }}
          >
            <X style={{ width: px(16), height: px(16) }} strokeWidth={2.5} />
          </div>

          {media.type === "video" && media.hasAudio && (
            <div
              className="absolute flex items-center justify-center rounded-full bg-black/50 text-white"
              style={{
                bottom: inset + (isDrawer ? px(34) : 0),
                left: inset,
                width: button,
                height: button,
              }}
            >
              <VolumeX style={{ width: px(16), height: px(16) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface WhatsNewPreviewProps {
  media: WhatsNewMedia | null;
  shownAs: WhatsNewPresentation;
}

export default function WhatsNewPreview({
  media,
  shownAs,
}: WhatsNewPreviewProps) {
  if (!media) {
    return (
      <div className="flex h-full min-h-60 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
        Upload an image or a video to preview it on a phone and on desktop.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Phone · {shownAs === "drawer" ? "Bottom drawer" : "Popup"}
        </p>
        <PreviewScreen
          screen={PHONE}
          frameWidth={PHONE_FRAME_WIDTH}
          media={media}
          shownAs={shownAs}
          frameClassName="rounded-[28px] ring-4 ring-gray-800"
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Desktop · always a popup
        </p>
        <PreviewScreen
          screen={DESKTOP}
          frameWidth={DESKTOP_FRAME_WIDTH}
          media={media}
          shownAs="popup"
          frameClassName="rounded-md ring-2 ring-gray-300"
        />
      </div>
      {media.type === "video" && (
        <p className="flex items-center gap-1 text-xs text-gray-500">
          <Volume2 className="h-3.5 w-3.5" />
          Plays muted here and in the app until the sound button is tapped.
        </p>
      )}
    </div>
  );
}
