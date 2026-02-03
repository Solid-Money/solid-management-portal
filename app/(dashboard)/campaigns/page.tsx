"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Plus, Trash2, Edit2, Eye, DollarSign, Calendar } from "lucide-react";
import CampaignModal from "@/components/campaign-modal";
import CampaignDetailModal from "@/components/campaign-detail-modal";
import { Campaign } from "@/types";
import { toast } from "sonner";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useAuth } from "@/components/auth-provider";

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/v1/campaigns");
      setCampaigns(response.data);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      toast.error("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/admin/v1/campaigns/${deleteId}`);
      toast.success("Campaign deleted successfully");
      setDeleteId(null);
      fetchCampaigns();
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      toast.error("Failed to delete campaign");
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
  };

  const handleView = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsDetailModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedCampaign(null);
    setIsModalOpen(true);
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Paused":
        return "bg-yellow-100 text-yellow-800";
      case "Ended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getEffectiveStatus = (campaign: Campaign) => {
    if (
      campaign.status === "Active" &&
      new Date(campaign.endDate) < new Date()
    ) {
      return "Ended";
    }

    return campaign.status;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage location-specific cashback campaigns
          </p>
        </div>
        {campaigns.length > 0 && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Campaign
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : campaigns.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cashback
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <tr key={campaign._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {campaign.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {campaign.merchantName}
                        {campaign.venueName && ` • ${campaign.venueName}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {(campaign.cashbackPercentage * 100).toFixed(0)}%
                        cashback • Max{" "}
                        {formatCurrency(campaign.maxDailyCashback)}
                        /day
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        getEffectiveStatus(campaign),
                      )}`}
                    >
                      {getEffectiveStatus(campaign)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(campaign.startDate)}
                      </div>
                      <div className="text-xs text-gray-400">
                        to {formatDate(campaign.endDate)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-green-600 font-medium">
                      <DollarSign className="h-4 w-4 mr-1" />
                      {campaign.totalCashbackPaid.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleView(campaign)}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(campaign)}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(campaign._id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg py-20 flex flex-col items-center justify-center space-y-4">
          <div className="text-gray-400">
            <svg
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">No campaigns created yet.</p>
          <p className="text-gray-400 text-sm">
            Create a campaign to offer location-specific cashback promotions.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm font-medium"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create First Campaign
          </button>
        </div>
      )}

      {isModalOpen && (
        <CampaignModal
          campaign={selectedCampaign}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchCampaigns();
          }}
        />
      )}

      {isDetailModalOpen && selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          onClose={() => setIsDetailModalOpen(false)}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Campaign"
        message="Are you sure you want to delete this campaign? This action cannot be undone."
        confirmText="Delete"
        isDestructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
