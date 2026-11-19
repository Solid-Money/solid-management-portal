"use client";

import { useState, useRef } from "react";
import {
  AlertTriangle,
  Film,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import api from "@/lib/api";
import WhatsNewCarouselPreview from "@/components/whats-new-carousel-preview";
import WhatsNewSingleForm from "@/components/whats-new-single-form";
import {
  IMAGE_TYPES,
  isVideoTooLong,
  type MediaFacts,
  SLIDE_RECOMMENDED_HEIGHT,
  SLIDE_RECOMMENDED_WIDTH,
  singleFormErrors,
  singlePayload,
  type SingleFormState,
  slideMediaWarnings,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
  VIDEO_TYPE,
} from "@/lib/whats-new";
import {
  readImageSize,
  readVideo,
  uploadImage,
  uploadPoster,
  uploadVideo,
} from "@/lib/whats-new-media";
import { WhatsNew, WhatsNewFormat, WhatsNewStep } from "@/types";

interface WhatsNewModalProps {
  popup?: WhatsNew | null;
  onClose: () => void;
  onSuccess: () => void;
}

const FORMAT_OPTIONS: { value: WhatsNewFormat; label: string }[] = [
  { value: "single", label: "Single image or video" },
  { value: "carousel", label: "Steps (carousel)" },
];

export default function WhatsNewModal({
  popup,
  onClose,
  onSuccess,
}: WhatsNewModalProps) {
  // New popups start as a single; saved ones keep theirs. Popups saved before
  // `format` existed are carousels.
  const [format, setFormat] = useState<WhatsNewFormat>(
    popup ? popup.format ?? "carousel" : "single"
  );
  const [single, setSingle] = useState<SingleFormState>(() => ({
    name: popup?.name ?? "",
    presentation: popup?.presentation ?? "popup",
    media: popup?.media ?? null,
    link: popup?.link ?? "",
    isActive: popup?.isActive ?? false,
    showOnLoad: popup?.showOnLoad ?? true,
  }));
  const [singleUploading, setSingleUploading] = useState(false);
  const [isActive, setIsActive] = useState(popup?.isActive ?? false);
  const [showOnLoad, setShowOnLoad] = useState(popup?.showOnLoad ?? true);
  // A single keeps no steps, so switching one to a carousel starts with a
  // blank step rather than none.
  const [steps, setSteps] = useState<WhatsNewStep[]>(
    popup?.steps?.length
      ? popup.steps
      : [{ imageUrl: "", title: "", text: "", buttonLabel: "", buttonLink: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  // Size and type of each slide's upload this session, for the guideline
  // warnings. Kept in step with `steps`.
  const [stepFacts, setStepFacts] = useState<(MediaFacts | null)[]>(() =>
    steps.map(() => null)
  );
  // The slide the preview shows: the last one edited.
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which slide the file picker is choosing for. Separate from
  // `uploadingIndex`, which is only set while an upload runs, so cancelling
  // the picker leaves nothing spinning.
  const pickIndexRef = useRef<number | null>(null);

  const openPicker = (index: number) => {
    pickIndexRef.current = index;
    fileInputRef.current?.click();
  };

  const handleAddStep = () => {
    setSteps([...steps, { imageUrl: "", title: "", text: "" }]);
    setStepFacts([...stepFacts, null]);
    setPreviewIndex(steps.length);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
    setStepFacts(stepFacts.filter((_, i) => i !== index));
    setPreviewIndex((current) => Math.max(0, Math.min(current, steps.length - 2)));
  };

  const updateStep = (index: number, patch: Partial<WhatsNewStep>) => {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...patch } : step))
    );
  };

  const handleStepChange = (
    index: number,
    field: "title" | "text" | "eyebrow" | "buttonLabel" | "buttonLink",
    value: string
  ) => updateStep(index, { [field]: value });

  const setFacts = (index: number, facts: MediaFacts) =>
    setStepFacts((current) => current.map((f, i) => (i === index ? facts : f)));

  /**
   * A slide takes an image, or a short MP4 whose poster (a frame a second in)
   * becomes its image, so older app versions still show something.
   */
  const handleStepMediaUpload = async (index: number, file: File) => {
    const isVideo = file.type.startsWith("video/");
    if (isVideo && file.type !== VIDEO_TYPE) {
      toast.error("Videos must be MP4 (H.264).");
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

    try {
      setUploadingIndex(index);
      if (isVideo) {
        const video = await readVideo(file);
        if (isVideoTooLong(video.durationSec)) {
          toast.error(
            `This video is ${Math.round(video.durationSec)} s. Keep it to a few seconds, ${VIDEO_MAX_SECONDS} s at most.`
          );
          return;
        }
        const posterUrl = await uploadPoster(video.poster, file.name);
        const url = await uploadVideo(file);
        updateStep(index, {
          imageUrl: posterUrl,
          videoUrl: url,
          videoDurationSec: Math.round(video.durationSec * 10) / 10,
        });
        setFacts(index, {
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
        updateStep(index, {
          imageUrl: url,
          videoUrl: undefined,
          videoDurationSec: undefined,
        });
        setFacts(index, { type: "image", ...size, sizeBytes: file.size, mimeType: file.type });
      }
      setPreviewIndex(index);
      toast.success(`${isVideo ? "Video" : "Image"} uploaded`);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error((error as Error).message || "Upload failed.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const saveSingle = async () => {
    const errors = singleFormErrors(single);
    if (errors.length > 0) {
      setShowErrors(true);
      toast.error(errors[0]);
      return;
    }

    try {
      setSaving(true);
      const data = singlePayload({ ...single, isActive, showOnLoad });
      if (popup) {
        await api.patch(`/admin/v1/whats-new/${popup._id}`, data);
      } else {
        await api.post("/admin/v1/whats-new", data);
      }
      onSuccess();
      toast.success(`Popup ${popup ? "updated" : "created"} successfully!`);
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save popup.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(false);

    if (format === "single") {
      await saveSingle();
      return;
    }

    if (steps.length === 0) {
      toast.error("Please add at least one step.");
      return;
    }

    const isMissingImage = steps.some((step) => !step.imageUrl);
    const isMissingContent = steps.some(
      (step) => !step.title.trim() || !step.text.trim()
    );

    if (isMissingImage || isMissingContent) {
      setShowErrors(true);
      if (isMissingImage) {
        toast.error("Please upload an image or video for every step.");
      } else {
        toast.error("Please fill in the title and description for all steps.");
      }
      return;
    }

    try {
      setSaving(true);
      const data = {
        format: "carousel" as const,
        steps,
        isActive,
        showOnLoad,
      };

      if (popup) {
        await api.patch(`/admin/v1/whats-new/${popup._id}`, data);
      } else {
        await api.post("/admin/v1/whats-new", data);
      }
      onSuccess();
      toast.success(`Popup ${popup ? "updated" : "created"} successfully!`);
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save popup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div
        className={`bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
          format === "single" ? "max-w-5xl" : "max-w-6xl"
        }`}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            {popup ? "Edit Popup" : "Create New Popup"}
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
          className="flex-1 overflow-y-auto p-6 space-y-8"
        >
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Format</span>
            <div
              role="radiogroup"
              aria-label="Format"
              className="flex w-fit rounded-md border border-gray-300 p-0.5"
            >
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={format === option.value}
                  onClick={() => {
                    setShowErrors(false);
                    setFormat(option.value);
                  }}
                  className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    format === option.value
                      ? "bg-indigo-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex space-x-8 bg-indigo-50 p-4 rounded-lg">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Set as Active
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnLoad}
                onChange={(e) => setShowOnLoad(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Show on App Load
              </span>
            </label>
          </div>

          {format === "single" ? (
            <WhatsNewSingleForm
              form={single}
              onChange={(next) =>
                setSingle((current) => ({ ...current, ...next }))
              }
              showErrors={showErrors}
              onUploadingChange={setSingleUploading}
            />
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Steps</h3>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </button>
              </div>

              {steps.map((step, index) => (
                <div
                  key={index}
                  onFocusCapture={() => setPreviewIndex(index)}
                  onClick={() => setPreviewIndex(index)}
                  className={`p-6 border rounded-xl space-y-4 relative bg-white shadow-sm ${
                    previewIndex === index ? "border-indigo-300" : "border-gray-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(index)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Image or video
                      </label>
                      <div
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 h-40 bg-gray-50 overflow-hidden relative group transition-colors ${
                          showErrors && !step.imageUrl
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300"
                        }`}
                      >
                        {step.imageUrl ? (
                          <>
                            <Image
                              src={step.imageUrl}
                              alt="Preview"
                              fill
                              className="object-cover rounded"
                            />
                            {step.videoUrl ? (
                              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                                <Film className="h-3 w-3" />
                                Video
                                {step.videoDurationSec !== undefined
                                  ? ` · ${step.videoDurationSec.toFixed(1)} s`
                                  : ""}
                              </span>
                            ) : null}
                            <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <button
                                type="button"
                                onClick={() => openPicker(index)}
                                className="p-2 bg-white rounded-full text-gray-900 cursor-pointer"
                              >
                                <Upload className="h-5 w-5" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPicker(index)}
                            className="flex flex-col items-center space-y-2 text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            {uploadingIndex === index ? (
                              <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-8 w-8" />
                                <span className="text-xs">Upload image or video</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        16:9, {SLIDE_RECOMMENDED_WIDTH} × {SLIDE_RECOMMENDED_HEIGHT}.
                        Phones crop the sides to 5:4, so keep the important part
                        in the middle. Video: MP4, a few seconds (
                        {VIDEO_MAX_SECONDS} s at most), plays muted on loop.
                      </p>
                      {step.videoUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateStep(index, {
                              videoUrl: undefined,
                              videoDurationSec: undefined,
                            })
                          }
                          className="text-xs text-gray-500 underline hover:text-red-600 cursor-pointer"
                        >
                          Remove video, keep its poster as the image
                        </button>
                      ) : null}
                      {stepFacts[index] && slideMediaWarnings(stepFacts[index]!).length > 0 ? (
                        <ul className="space-y-1 rounded-md bg-amber-50 p-2">
                          {slideMediaWarnings(stepFacts[index]!).map((warning) => (
                            <li
                              key={warning}
                              className="flex items-start gap-1.5 text-xs text-amber-800"
                            >
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {warning}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="md:col-span-2 space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          Label above the title{" "}
                          <span className="font-normal text-gray-400">
                            (optional)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={step.eyebrow ?? ""}
                          maxLength={40}
                          onChange={(e) =>
                            handleStepChange(index, "eyebrow", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="e.g. Spend your crypto"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          Title
                        </label>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) =>
                            handleStepChange(index, "title", e.target.value)
                          }
                          className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                            showErrors && !step.title.trim()
                              ? "border-red-300 bg-red-50"
                              : "border-gray-300"
                          }`}
                          placeholder="Step title"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          Description
                        </label>
                        <textarea
                          value={step.text}
                          onChange={(e) =>
                            handleStepChange(index, "text", e.target.value)
                          }
                          className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 h-24 ${
                            showErrors && !step.text.trim()
                              ? "border-red-300 bg-red-50"
                              : "border-gray-300"
                          }`}
                          placeholder="What's new in this update?"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">
                            Button Label{" "}
                            <span className="font-normal text-gray-400">
                              (optional)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={step.buttonLabel ?? ""}
                            onChange={(e) =>
                              handleStepChange(
                                index,
                                "buttonLabel",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g. Check your tier"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">
                            Button Link{" "}
                            <span className="font-normal text-gray-400">
                              (optional)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={step.buttonLink ?? ""}
                            onChange={(e) =>
                              handleStepChange(
                                index,
                                "buttonLink",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="https://... or /rewards"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Add both to give this slide its green button. Without
                        them the button says Next, or Done on the last slide.
                        Links can be an external URL (https://...) or an in-app
                        route (e.g. /rewards).
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:sticky lg:top-0 self-start">
              <WhatsNewCarouselPreview
                steps={steps}
                selected={previewIndex}
                onSelect={setPreviewIndex}
              />
            </div>
            </div>
          )}
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
            disabled={saving || uploadingIndex !== null || singleUploading}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Popup"
            )}
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          const index = pickIndexRef.current;
          pickIndexRef.current = null;
          if (file && index !== null) {
            void handleStepMediaUpload(index, file);
          }
          e.target.value = ""; // Reset
        }}
        className="hidden"
        accept={[...IMAGE_TYPES, VIDEO_TYPE].join(",")}
      />
    </div>
  );
}
