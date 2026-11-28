"use client";

import { Smartphone } from "lucide-react";

/**
 * Roughly how the push reads on a lock screen, collapsed: the part of the body
 * past `collapsedAt` is shown faded, because that is where the phone cuts it.
 * Adapted from the push campaign composer's preview, with the push image.
 */
export function PushPreview({
  title,
  body,
  imageUrl,
  collapsedAt,
}: {
  title: string;
  body: string;
  imageUrl: string | null;
  collapsedAt: number;
}) {
  const text = body.trim();
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Smartphone className="h-3 w-3" />
        Preview, with example values
      </span>
      <div className="rounded-2xl bg-gray-100 p-3">
        <div className="flex gap-3 rounded-xl bg-white/90 p-3 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-4 w-4 rounded bg-gray-900" />
                Solid
              </span>
              <span>now</span>
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900">
              {title.trim() || "Title"}
            </p>
            {text ? (
              <p className="text-sm text-gray-700">
                {text.slice(0, collapsedAt)}
                {text.length > collapsedAt ? (
                  <span className="text-gray-300">{text.slice(collapsedAt)}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- an admin-supplied URL on any host, shown at 40px
            <img
              src={imageUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
