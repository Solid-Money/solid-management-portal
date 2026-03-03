"use client";

import { X, DollarSign, Calendar, Store, Percent } from "lucide-react";
import { Campaign } from "@/types";

interface CampaignDetailModalProps {
  campaign: Campaign;
  onClose: () => void;
}

export default function CampaignDetailModal({
  campaign,
  onClose,
}: CampaignDetailModalProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getEffectiveStatus = () => {
    if (
      campaign.status === "Active" &&
      new Date(campaign.endDate) < new Date()
    ) {
      return "Ended";
    }

    return campaign.status;
  };

  const effectiveStatus = getEffectiveStatus();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{campaign.name}</h2>
            <p className="text-sm text-gray-500">Campaign Details</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stats Overview */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Cashback Paid</p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(campaign.totalCashbackPaid)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(campaign.startDate)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">End Date</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(campaign.endDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign Info */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configuration
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Store className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-500">Merchant Name</p>
                  <p className="font-medium text-gray-900">
                    {campaign.merchantName}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Percent className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-gray-500">Cashback Rate</p>
                  <p className="font-medium text-gray-900">
                    {(campaign.cashbackPercentage * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-gray-500">Max Daily Cashback</p>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(campaign.maxDailyCashback)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-gray-500">Payout Type</p>
                <p className="font-medium text-gray-900">
                  {campaign.isInstant ? "Instant" : "Escrowed"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Country</p>
                <p className="font-medium text-gray-900">
                  {campaign.country || "Any"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    effectiveStatus === "Active"
                      ? "bg-green-100 text-green-800"
                      : effectiveStatus === "Paused"
                        ? "bg-yellow-100 text-yellow-800"
                        : effectiveStatus === "Ended"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {effectiveStatus}
                </span>
              </div>
            </div>

            {campaign.description && (
              <div className="mt-6">
                <p className="text-gray-500 text-sm">Description</p>
                <p className="font-medium text-gray-900 mt-1">
                  {campaign.description}
                </p>
              </div>
            )}

            {(campaign.venueName || campaign.venueLocation) && (
              <div className="mt-6">
                <p className="text-gray-500 text-sm">Venue</p>
                <p className="font-medium text-gray-900 mt-1">
                  {[campaign.venueName, campaign.venueLocation]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
