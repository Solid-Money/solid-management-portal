"use client";

import { useState, useRef } from "react";
import { X, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import api from "@/lib/api";
import { WhatsNew, WhatsNewStep } from "@/types";

interface WhatsNewModalProps {
  popup?: WhatsNew | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WhatsNewModal({
  popup,
  onClose,
  onSuccess,
}: WhatsNewModalProps) {
  const [isActive, setIsActive] = useState(popup?.isActive ?? false);
  const [showOnLoad, setShowOnLoad] = useState(popup?.showOnLoad ?? true);
  const [steps, setSteps] = useState<WhatsNewStep[]>(
    popup?.steps || [{ imageUrl: "", title: "", text: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddStep = () => {
    setSteps([...steps, { imageUrl: "", title: "", text: "" }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (
    index: number,
    field: keyof WhatsNewStep,
    value: string
  ) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const handleImageUpload = async (index: number, file: File) => {
    try {
      setUploadingIndex(index);
      const response = await fetch(`/api/upload?filename=${file.name}`, {
        method: "POST",
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const blob = await response.json();
      handleStepChange(index, "imageUrl", blob.url);
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload image.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(false);

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
        toast.error("Please upload an image for all steps.");
      } else {
        toast.error("Please fill in the title and description for all steps.");
      }
      return;
    }

    try {
      setSaving(true);
      const data = {
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
                className="p-6 border border-gray-200 rounded-xl space-y-4 relative bg-white shadow-sm"
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
                      Step Image
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
                          <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setUploadingIndex(index);
                                fileInputRef.current?.click();
                              }}
                              className="p-2 bg-white rounded-full text-gray-900 cursor-pointer"
                            >
                              <Upload className="h-5 w-5" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setUploadingIndex(index);
                            fileInputRef.current?.click();
                          }}
                          className="flex flex-col items-center space-y-2 text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          {uploadingIndex === index ? (
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

                  <div className="md:col-span-2 space-y-4">
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
                  </div>
                </div>
              </div>
            ))}
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
            disabled={saving || uploadingIndex !== null}
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
          if (file && uploadingIndex !== null) {
            handleImageUpload(uploadingIndex, file);
          }
          e.target.value = ""; // Reset
        }}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
}
