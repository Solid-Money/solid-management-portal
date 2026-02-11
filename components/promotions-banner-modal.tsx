"use client";

import { useState, useRef } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import api from "@/lib/api";
import { PromotionsBanner } from "@/types";

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
  const [enabled, setEnabled] = useState(banner?.enabled ?? false);
  const [sort, setSort] = useState<number>(banner?.sort ?? 0);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(false);

    if (!title.trim() || !imageURL) {
      setShowErrors(true);
      if (!title.trim()) {
        toast.error("Please enter a title.");
      } else {
        toast.error("Please upload an image.");
      }
      return;
    }

    try {
      setSaving(true);
      const data = { title: title.trim(), imageURL, enabled, sort };

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
            disabled={saving || uploading}
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
    </div>
  );
}
