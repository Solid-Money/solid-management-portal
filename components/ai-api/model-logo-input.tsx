"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED = "image/svg+xml,image/png,image/webp,image/jpeg";
const MAX_BYTES = 512 * 1024;

/**
 * A model's logo: uploaded to Vercel Blob, like the promotion banners, and
 * shown by the app beside the model on every platform. A square image works
 * best; it is drawn in a circle about 32px across.
 */
export function ModelLogoInput({
  value,
  name,
  disabled,
  onChange,
}: {
  value: string;
  /** The model or provider, for the uploaded file's name and the alt text. */
  name: string;
  disabled: boolean;
  onChange: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!ACCEPTED.split(",").includes(file.type)) {
      toast.error("Use an SVG, PNG, WebP or JPEG logo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logos must be 512 KB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const slug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "model";
      const response = await fetch(
        `/api/upload?filename=${encodeURIComponent(`ai-api/logos/${slug}.${extension}`)}`,
        { method: "POST", body: file },
      );
      if (!response.ok) throw new Error("Upload failed");
      const blob = (await response.json()) as { url?: string };
      if (!blob.url) throw new Error("Upload failed");
      onChange(blob.url);
    } catch {
      toast.error("Couldn't upload the logo. Try again.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="relative h-9 w-9">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => input.current?.click()}
        title={value ? "Replace logo" : "Upload logo"}
        className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        ) : value ? (
          <Image
            src={value}
            alt={`${name || "Model"} logo`}
            width={36}
            height={36}
            unoptimized
            className="h-full w-full object-contain"
          />
        ) : (
          <ImagePlus className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {value && !disabled && !uploading ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Remove logo"
          className="absolute -right-1 -top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-white text-gray-400 shadow ring-1 ring-gray-200 hover:text-red-600"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
