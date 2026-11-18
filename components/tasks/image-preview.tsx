"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface PreviewImage {
  src: string;
  name: string | null;
  /** What opened it: focus goes back there when it closes. */
  from?: HTMLElement | null;
}

/**
 * An image from a task at full size: as big as the screen allows, with its
 * name and a link to open the original in a new tab. Esc, the close button
 * or a click outside closes it.
 */
export default function ImagePreview({
  image,
  onClose,
}: {
  image: PreviewImage | null;
  onClose: () => void;
}) {
  // Kept past close (the image is gone by then) to put focus back.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (image) opener.current = image.from ?? null;
  }, [image]);
  return (
    <Dialog open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          const from = opener.current;
          if (!from?.isConnected) return;
          event.preventDefault();
          from.focus();
        }}
        className="flex max-h-[94dvh] w-auto max-w-[min(94vw,1600px)] flex-col gap-3 border-0 bg-white p-3 sm:max-w-[min(94vw,1600px)]"
      >
        <DialogTitle className="sr-only">{image?.name ?? "Image"}</DialogTitle>
        <DialogDescription className="sr-only">The image at full size.</DialogDescription>
        {image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived link to the support service */}
            <img
              src={image.src}
              alt={image.name ?? "Image"}
              className="mx-auto max-h-[calc(94dvh-4.5rem)] w-auto max-w-full rounded-md object-contain"
            />
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <span className="min-w-0 truncate text-gray-600">{image.name ?? "Image"}</span>
              <a
                href={image.src}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-indigo-700 hover:underline"
              >
                Open original <ExternalLink className="size-3.5" />
              </a>
              <DialogClose className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
