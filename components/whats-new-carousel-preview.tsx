"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { WhatsNewStep } from "@/types";

/**
 * Logical screens the frames stand for, and how wide each frame is drawn. The
 * card is laid out at full size in app points and scaled down, so the preview
 * keeps the app's proportions exactly.
 */
const PHONE = { width: 393, height: 852, frame: 220 };
const DESKTOP = { width: 1440, height: 900, frame: 320 };

const BRAND = "#94F27F";

interface CardProps {
  step: WhatsNewStep;
  index: number;
  count: number;
}

const Media = ({
  step,
  width,
  height,
}: {
  step: WhatsNewStep;
  width: number;
  height: number;
}) => (
  <div
    className="relative overflow-hidden"
    style={{ width, height, borderRadius: 16, background: "#0C0E0D" }}
  >
    {step.videoUrl ? (
      <video
        key={step.videoUrl}
        src={step.videoUrl}
        poster={step.imageUrl}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      />
    ) : step.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- a live preview of an arbitrary upload
      <img src={step.imageUrl} alt="" className="h-full w-full object-cover" />
    ) : null}
  </div>
);

const Dots = ({ count, index }: { count: number; index: number }) =>
  count > 1 ? (
    <div className="flex items-center" style={{ gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            height: 6,
            width: i === index ? 22 : 6,
            background: i === index ? BRAND : "rgba(255,255,255,0.25)",
          }}
        />
      ))}
    </div>
  ) : null;

const buttonLabel = (step: WhatsNewStep, isLast: boolean) =>
  step.buttonLabel?.trim() && step.buttonLink?.trim()
    ? step.buttonLabel.trim()
    : isLast
      ? "Done"
      : "Next";

/** The phone card, at app size: 16pt margins, bottom-anchored, 5:4 media. */
const PhoneCard = ({ step, index, count }: CardProps) => {
  const cardWidth = PHONE.width - 32;
  const pageWidth = cardWidth - 34;
  return (
    <div
      className="absolute left-4 text-white"
      style={{
        bottom: 34,
        width: cardWidth,
        padding: "16px 17px 21px",
        borderRadius: 24,
        background: "#151918",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="mb-3 flex items-center justify-between pl-1">
        <span style={{ fontSize: 15 }} className="font-medium text-white/70">
          What&apos;s new
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <X className="h-[18px] w-[18px]" />
        </span>
      </div>
      <Media step={step} width={pageWidth} height={pageWidth * 0.8} />
      <div className="mt-6 px-2 text-center">
        {step.eyebrow?.trim() ? (
          <p className="font-semibold" style={{ color: BRAND, fontSize: 15, lineHeight: "20px" }}>
            {step.eyebrow}
          </p>
        ) : null}
        <p
          className={`font-semibold ${step.eyebrow?.trim() ? "mt-2" : ""}`}
          style={{ fontSize: 26, lineHeight: "30px" }}
        >
          {step.title || "Title"}
        </p>
        <p className="mt-2 text-white/80" style={{ fontSize: 16, lineHeight: "22px" }}>
          {step.text || "Description"}
        </p>
      </div>
      <div className="mt-6 flex justify-center">
        <Dots count={count} index={index} />
      </div>
      <div
        className="mt-6 flex items-center justify-center rounded-full font-semibold text-black"
        style={{ height: 52, background: BRAND, fontSize: 17 }}
      >
        {buttonLabel(step, index === count - 1)}
      </div>
    </div>
  );
};

/** The desktop card, at app size: 640 wide, centred, 16:9 media. */
const DesktopCard = ({ step, index, count }: CardProps) => {
  const pageWidth = 640 - 52;
  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
      style={{
        width: 640,
        padding: "26px 26px 33px",
        borderRadius: 24,
        background: "#151918",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="relative">
        <Media step={step} width={pageWidth} height={(pageWidth * 9) / 16} />
        <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50">
          <X className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className="mt-8 px-4">
        {step.eyebrow?.trim() ? (
          <p className="font-semibold" style={{ color: BRAND, fontSize: 16, lineHeight: "22px" }}>
            {step.eyebrow}
          </p>
        ) : null}
        <p
          className={`font-semibold ${step.eyebrow?.trim() ? "mt-3" : ""}`}
          style={{ fontSize: 36, lineHeight: "40px" }}
        >
          {step.title || "Title"}
        </p>
        <p className="mt-3 text-white/80" style={{ fontSize: 18, lineHeight: "26px" }}>
          {step.text || "Description"}
        </p>
      </div>
      <div className="mt-8 flex items-center justify-between px-4">
        {count > 1 ? (
          <div className="flex items-center" style={{ gap: 14 }}>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full ${index === 0 ? "bg-white/[0.04] text-white/35" : "bg-white/10"}`}
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </span>
            <Dots count={count} index={index} />
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full ${index === count - 1 ? "bg-white/[0.04] text-white/35" : "bg-white/10"}`}
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </span>
          </div>
        ) : (
          <span />
        )}
        <span
          className="flex items-center rounded-full px-7 font-semibold text-black"
          style={{ height: 48, background: BRAND, fontSize: 17 }}
        >
          {buttonLabel(step, index === count - 1)}
        </span>
      </div>
    </div>
  );
};

const Screen = ({
  screen,
  className,
  children,
}: {
  screen: { width: number; height: number; frame: number };
  className: string;
  children: React.ReactNode;
}) => {
  const scale = screen.frame / screen.width;
  return (
    <div
      className={`relative overflow-hidden bg-[#111] ${className}`}
      style={{ width: screen.frame, height: screen.height * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: screen.width, height: screen.height, transform: `scale(${scale})` }}
      >
        <div className="absolute inset-0 bg-black/70" />
        {children}
      </div>
    </div>
  );
};

interface WhatsNewCarouselPreviewProps {
  steps: WhatsNewStep[];
  selected: number;
  onSelect: (index: number) => void;
}

/**
 * Jayant's carousel (T-68) as the app draws it: the phone card and the
 * desktop card for one slide. Videos play muted.
 */
export default function WhatsNewCarouselPreview({
  steps,
  selected,
  onSelect,
}: WhatsNewCarouselPreviewProps) {
  if (steps.length === 0) return null;
  const index = Math.min(selected, steps.length - 1);
  const step = steps[index];

  return (
    <div className="space-y-4">
      {steps.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Preview slide">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => onSelect(i)}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                i === index ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Slide {i + 1}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Phone</p>
        <Screen screen={PHONE} className="rounded-[28px] ring-4 ring-gray-800">
          <PhoneCard step={step} index={index} count={steps.length} />
        </Screen>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Desktop</p>
        <Screen screen={DESKTOP} className="rounded-md ring-2 ring-gray-300">
          <DesktopCard step={step} index={index} count={steps.length} />
        </Screen>
      </div>
    </div>
  );
}
