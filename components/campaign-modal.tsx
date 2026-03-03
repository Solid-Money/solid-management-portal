"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Campaign, CampaignStatus } from "@/types";

interface CampaignModalProps {
  campaign?: Campaign | null;
  onClose: () => void;
  onSuccess: () => void;
}

const statusOptions: CampaignStatus[] = ["Draft", "Active", "Paused", "Ended"];

export default function CampaignModal({
  campaign,
  onClose,
  onSuccess,
}: CampaignModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    country: "",
    venueName: "",
    venueLocation: "",
    merchantName: "",
    cashbackPercentage: 0.5,
    maxDailyCashback: 25,
    isInstant: true,
    startDate: "",
    endDate: "",
    emailTemplateId: "",
    status: "Draft" as CampaignStatus,
  });

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        description: campaign.description || "",
        country: campaign.country || "",
        venueName: campaign.venueName || "",
        venueLocation: campaign.venueLocation || "",
        merchantName: campaign.merchantName,
        cashbackPercentage: campaign.cashbackPercentage,
        maxDailyCashback: campaign.maxDailyCashback,
        isInstant: campaign.isInstant,
        startDate: campaign.startDate
          ? new Date(campaign.startDate).toISOString().split("T")[0]
          : "",
        endDate: campaign.endDate
          ? new Date(campaign.endDate).toISOString().split("T")[0]
          : "",
        emailTemplateId: campaign.emailTemplateId?.toString() || "",
        status: campaign.status,
      });
    }
  }, [campaign]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : type === "number"
            ? parseFloat(value) || 0
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter a campaign name.");
      return;
    }

    if (!formData.merchantName.trim()) {
      toast.error("Please enter a merchant name.");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error("Please set start and end dates.");
      return;
    }

    try {
      setSaving(true);
      const data = {
        ...formData,
        emailTemplateId: formData.emailTemplateId
          ? parseInt(formData.emailTemplateId)
          : undefined,
      };

      if (campaign) {
        await api.patch(`/admin/v1/campaigns/${campaign._id}`, data);
        toast.success("Campaign updated successfully!");
      } else {
        await api.post("/admin/v1/campaigns", data);
        toast.success("Campaign created successfully!");
      }
      onSuccess();
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save campaign.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            {campaign ? "Edit Campaign" : "Create New Campaign"}
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
          {/* Campaign Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Campaign Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Azul Cafe 50% Cashback"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Optional description of the campaign"
              />
            </div>
          </div>

          {/* Location & Targeting */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Location & Targeting
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country Code
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., AR"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue Name
                </label>
                <input
                  type="text"
                  name="venueName"
                  value={formData.venueName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Azul Cafe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue Location
                </label>
                <input
                  type="text"
                  name="venueLocation"
                  value={formData.venueLocation}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Buenos Aires"
                />
              </div>
            </div>
          </div>

          {/* Merchant Matching */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Merchant Matching
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Merchant Name *
              </label>
              <input
                type="text"
                name="merchantName"
                value={formData.merchantName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., AZUL CAFE BA"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the exact merchant name as it appears in card
                transactions. Check a recent transaction at this location to
                find the correct name (e.g., &quot;AZUL CAFE BA&quot;). This is
                used to match card purchases to this campaign.
              </p>
            </div>
          </div>

          {/* Cashback Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Cashback Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cashback Percentage *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="cashbackPercentage"
                    value={formData.cashbackPercentage}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <span className="absolute right-8 top-2 text-gray-500">
                    ({(formData.cashbackPercentage * 100).toFixed(0)}%)
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  0.5 = 50%, 0.25 = 25%
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Daily Cashback (USD) *
                </label>
                <input
                  type="number"
                  name="maxDailyCashback"
                  value={formData.maxDailyCashback}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isInstant"
                name="isInstant"
                checked={formData.isInstant}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isInstant: e.target.checked,
                  }))
                }
                className="h-4 w-4 text-indigo-600 rounded"
              />
              <label htmlFor="isInstant" className="text-sm text-gray-700">
                Instant Payout (no escrow period)
              </label>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Notifications
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brevo Email Template ID
              </label>
              <input
                type="number"
                name="emailTemplateId"
                value={formData.emailTemplateId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Optional - leave empty to skip email"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Status
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
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
            disabled={saving}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Campaign"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
