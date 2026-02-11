"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Plus, Trash2, Edit2 } from "lucide-react";
import PromotionsBannerModal from "@/components/promotions-banner-modal";
import { PromotionsBanner } from "@/types";
import { toast } from "sonner";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useAuth } from "@/components/auth-provider";

export default function PromotionsBannerPage() {
  const { user } = useAuth();
  const [banners, setBanners] = useState<PromotionsBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<PromotionsBanner | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/v1/promotions-banner");
      setBanners(response.data);
    } catch (error) {
      console.error("Failed to fetch banners:", error);
      toast.error("Failed to fetch banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBanners();
    }
  }, [user]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/admin/v1/promotions-banner/${deleteId}`);
      toast.success("Banner deleted successfully");
      setDeleteId(null);
      fetchBanners();
    } catch (error) {
      console.error("Failed to delete banner:", error);
      toast.error("Failed to delete banner");
    }
  };

  const handleEdit = (banner: PromotionsBanner) => {
    setSelectedBanner(banner);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedBanner(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Promotions Banners
        </h1>
        {banners.length > 0 && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create New
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : banners.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {[...banners]
            .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
            .map((banner) => (
              <li key={banner._id} className="hover:bg-gray-50 transition-colors">
                <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {banner.title}
                      </p>
                      <span
                        className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          banner.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {banner.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="mt-1">
                      <p className="text-xs text-gray-500">
                        Sort: {banner.sort ?? 0} • Created at{" "}
                        {banner.createdAt
                          ? new Date(banner.createdAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(banner)}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(banner._id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg py-20 flex flex-col items-center justify-center space-y-4">
          <p className="text-gray-500 text-lg">No banners created yet.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm font-medium"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create First Banner
          </button>
        </div>
      )}

      {isModalOpen && (
        <PromotionsBannerModal
          banner={selectedBanner}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchBanners();
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Banner"
        message="Are you sure you want to delete this banner? This action cannot be undone."
        confirmText="Delete"
        isDestructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
