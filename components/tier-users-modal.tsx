"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { getTierRecipients } from "@/lib/api";

interface TierUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: number;
}

export default function TierUsersModal({
  isOpen,
  onClose,
  tier,
}: TierUsersModalProps) {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getTierRecipients(tier);
      setEmails(response.data.emails);
      setCount(response.data.count);
    } catch (error) {
      console.error("Failed to fetch tier users:", error);
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">
            Tier {tier} Users
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{count}</span> users in Tier{" "}
                  {tier}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Team accounts (excluded wallets) are not included
                </p>
              </div>
              <div className="space-y-1">
                {emails.map((email, i) => (
                  <div
                    key={i}
                    className="text-sm text-gray-600 py-1 px-2 bg-gray-50 rounded"
                  >
                    {email}
                  </div>
                ))}
                {emails.length === 0 && (
                  <p className="text-sm text-gray-400">
                    No users found in this tier
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end">
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
