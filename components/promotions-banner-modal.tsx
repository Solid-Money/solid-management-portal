"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  fetchLatestAppVersion,
  isValidPagePath,
  isValidVersionGate,
  normalizePagePath,
  normalizeVersionGate,
} from "@/lib/promotions-banner";
import { LatestAppVersion, PromotionsBanner } from "@/types";

interface PromotionsBannerModalProps {
  banner?: PromotionsBanner | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PromotionsBannerModal({
  banner,
  onClose,
  onSuccess,
}: PromotionsBannerModalProps) {
  const [title, setTitle] = useState(banner?.title ?? "");
  const [imageURL, setImageURL] = useState(banner?.imageURL ?? "");
  const [mobileImageURL, setMobileImageURL] = useState(banner?.mobileImageURL ?? "");
  const [enabled, setEnabled] = useState(banner?.enabled ?? false);
  const [sort, setSort] = useState<number>(banner?.sort ?? 0);
  const [link, setLink] = useState(banner?.link ?? "");
  const [version, setVersion] = useState(banner?.version ?? "");
  const [page, setPage] = useState(banner?.page ?? "");
  const [platforms, setPlatforms] = useState({
    web: banner?.platforms?.web ?? true,
    ios: banner?.platforms?.ios ?? true,
    android: banner?.platforms?.android ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [latestVersion, setLatestVersion] = useState<LatestAppVersion | null>(
    null
  );
  const [loadingLatestVersion, setLoadingLatestVersion] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  const isVersionValid = isValidVersionGate(version);
  const isPageValid = isValidPagePath(page);

  const loadLatestVersion = useCallback(async (): Promise<LatestAppVersion> => {
    setLoadingLatestVersion(true);
    try {
      const latest = await fetchLatestAppVersion();
      setLatestVersion(latest);
      return latest;
    } finally {
      setLoadingLatestVersion(false);
    }
  }, []);

  // Prefetched so the current app version is on screen while the admin decides,
  // rather than only after they press Latest. The route caches server-side, so
  // opening the form repeatedly costs one shared lookup.
  useEffect(() => {
    loadLatestVersion().catch((error) => {
      console.error("Latest app version lookup failed:", error);
    });
  }, [loadLatestVersion]);

  const handleUseLatestVersion = async () => {
    try {
      const latest = latestVersion ?? (await loadLatestVersion());
      setVersion(`>=${latest.version}`);
    } catch (error) {
      console.error("Latest app version lookup failed:", error);
      toast.error("Could not look up the latest app version.");
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      const response = await fetch(`/api/upload?filename=${file.name}`, {
        method: "POST",
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const blob = await response.json();
      setImageURL(blob.url);
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handleMobileImageUpload = async (file: File) => {
    try {
      setUploadingMobile(true);
      const response = await fetch(`/api/upload?filename=${file.name}`, {
        method: "POST",
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload mobile image");
      }

      const blob = await response.json();
      setMobileImageURL(blob.url);
      toast.success("Mobile image uploaded successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload mobile image.");
    } finally {
      setUploadingMobile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(false);

    if (!title.trim() || !imageURL || !isVersionValid || !isPageValid) {
      setShowErrors(true);
      if (!title.trim()) {
        toast.error("Please enter a title.");
      } else if (!imageURL) {
        toast.error("Please upload an image.");
      } else if (!isVersionValid) {
        toast.error('Version must look like ">=2.0.0" or "1.0.12".');
      } else {
        toast.error('Page must be a pathname such as "/" or "/savings".');
      }
      return;
    }

    try {
      setSaving(true);
      const data = {
        title: title.trim(),
        imageURL,
        ...(mobileImageURL ? { mobileImageURL } : {}),
        enabled,
        sort,
        ...(link.trim() ? { link: link.trim() } : {}),
        platforms,
        // Always sent, blank included: an empty value is how the backend is told
        // to drop an existing gate rather than leave the old one in place.
        version: normalizeVersionGate(version),
        page: normalizePagePath(page),
      };

      if (banner) {
        await api.patch(`/admin/v1/promotions-banner/${banner._id}`, data);
      } else {
        await api.post("/admin/v1/promotions-banner", data);
      }
      onSuccess();
      toast.success(`Banner ${banner ? "updated" : "created"} successfully!`);
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save banner.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            {banner ? "Edit Banner" : "Create New Banner"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center gap-4 bg-indigo-50 p-4 rounded-lg">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Enabled</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort</label>
              <input
                type="number"
                value={sort}
                onChange={(e) => setSort(Number(e.target.value) || 0)}
                className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                showErrors && !title.trim()
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
              placeholder="Banner title"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Link (optional)
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              App Version (optional)
            </label>
            <p className="text-xs text-gray-500">
              Which native app builds show this banner.{" "}
              <code>&gt;=2.0.0</code> targets that version and every newer one,{" "}
              <code>1.0.12</code> only that exact version. Leave empty to show on
              every version. Ignored on web, which always runs the latest build.
            </p>
            <div
              className={`flex flex-row justify-between items-center gap-2 w-full px-3 py-2 border rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 ${
                showErrors && !isVersionValid
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
            >
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none"
                placeholder=">=2.0.0"
              />
              <button
                type="button"
                onClick={handleUseLatestVersion}
                disabled={loadingLatestVersion}
                title={
                  latestVersion
                    ? `Set to >=${latestVersion.version}`
                    : "Look up the current app version"
                }
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loadingLatestVersion && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                Latest
              </button>
            </div>
            {showErrors && !isVersionValid ? (
              <p className="text-xs text-red-600">
                Use a version like <code>2.0.0</code>, optionally prefixed with{" "}
                <code>&gt;=</code>, <code>&gt;</code>, <code>&lt;=</code>,{" "}
                <code>&lt;</code> or <code>=</code>.
              </p>
            ) : (
              latestVersion && (
                <p className="text-xs text-gray-500">
                  Current app version: {latestVersion.version}
                  {latestVersion.branch
                    ? ` (solid-ui ${latestVersion.branch})`
                    : " (App Store)"}
                </p>
              )
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Page (optional)
            </label>
            <p className="text-xs text-gray-500">
              Which page shows this banner. <code>/</code> is the home/wallet
              page; <code>savings</code> and <code>/savings</code> both mean{" "}
              <code>/savings</code>. Leave empty to show on every page.
            </p>
            <input
              type="text"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                showErrors && !isPageValid
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
              placeholder="/savings"
            />
            {showErrors && !isPageValid && (
              <p className="text-xs text-red-600">
                Use a pathname such as <code>/</code>, <code>/savings</code> or{" "}
                <code>/card/details</code>.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Platforms
            </label>
            <p className="text-xs text-gray-500">
              Choose which platforms display this banner in the app.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {(
                [
                  { key: "web", label: "Web" },
                  { key: "ios", label: "iOS" },
                  { key: "android", label: "Android" },
                ] as const
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={platforms[key]}
                    onChange={(e) =>
                      setPlatforms((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Image</label>
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 h-40 bg-gray-50 overflow-hidden relative group transition-colors ${
                showErrors && !imageURL
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
            >
              {imageURL ? (
                <>
                  <Image
                    src={imageURL}
                    alt="Preview"
                    fill
                    className="object-cover rounded"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-white rounded-full text-gray-900 cursor-pointer"
                    >
                      <Upload className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex flex-col items-center space-y-2 text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8" />
                      <span className="text-xs">Upload Banner</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Mobile Image (optional)
            </label>
            <p className="text-xs text-gray-500">
              Used on mobile screens. Falls back to the main image if not provided.
            </p>
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 h-40 bg-gray-50 overflow-hidden relative group transition-colors border-gray-300"
            >
              {mobileImageURL ? (
                <>
                  <Image
                    src={mobileImageURL}
                    alt="Mobile Preview"
                    fill
                    className="object-cover rounded"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button
                      type="button"
                      onClick={() => mobileFileInputRef.current?.click()}
                      className="p-2 bg-white rounded-full text-gray-900 cursor-pointer"
                    >
                      <Upload className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileImageURL("")}
                      className="p-2 bg-white rounded-full text-gray-900 cursor-pointer ml-2"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => mobileFileInputRef.current?.click()}
                  disabled={uploadingMobile}
                  className="flex flex-col items-center space-y-2 text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploadingMobile ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8" />
                      <span className="text-xs">Upload Mobile Banner</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploading || uploadingMobile}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Banner"
            )}
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageUpload(file);
          }
          e.target.value = "";
        }}
        className="hidden"
        accept="image/*"
      />
      <input
        type="file"
        ref={mobileFileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleMobileImageUpload(file);
          }
          e.target.value = "";
        }}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
}
