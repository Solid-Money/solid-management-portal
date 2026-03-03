"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle } from "lucide-react";
import { getTierRecipients, sendTierEmail } from "@/lib/api";
import ConfirmationModal from "@/components/ui/confirmation-modal";

interface TierEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: number;
}

export default function TierEmailModal({
  isOpen,
  onClose,
  tier,
}: TierEmailModalProps) {
  const [templateId, setTemplateId] = useState("");
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [sampleEmails, setSampleEmails] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);

  const fetchRecipients = useCallback(async () => {
    try {
      setRecipientsLoading(true);
      const response = await getTierRecipients(tier);
      setRecipientCount(response.data.count);
      setSampleEmails(response.data.emails.slice(0, 10));
    } catch (error) {
      console.error("Failed to fetch recipients:", error);
    } finally {
      setRecipientsLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    if (isOpen) {
      fetchRecipients();
    }
  }, [isOpen, fetchRecipients]);

  const reset = () => {
    setTemplateId("");
    setRecipientCount(null);
    setSampleEmails([]);
    setResult(null);
    setShowConfirm(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    setShowConfirm(false);
    try {
      setSendLoading(true);
      const response = await sendTierEmail(tier, Number(templateId));
      setResult(response.data);
    } catch (error) {
      console.error("Failed to send tier email:", error);
    } finally {
      setSendLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">
              Send Email to Tier {tier}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {result ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Send Complete</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">
                      {result.sent}
                    </p>
                    <p className="text-sm text-green-600">Sent</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">
                      {result.failed}
                    </p>
                    <p className="text-sm text-red-600">Failed</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    Make sure the Brevo template is{" "}
                    <strong>activated</strong> before sending. Inactive templates
                    will fail silently.
                  </p>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Brevo Template ID
                  </label>
                  <input
                    type="number"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    placeholder="Enter template ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {recipientsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700">
                      <strong>{recipientCount}</strong> users in Tier {tier}
                    </p>
                    {sampleEmails.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          Sample recipients (first 10):
                        </p>
                        <div className="space-y-1">
                          {sampleEmails.map((email, i) => (
                            <div
                              key={i}
                              className="text-xs text-gray-600 py-1 px-2 bg-gray-50 rounded"
                            >
                              {email}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={
                  recipientCount === null ||
                  recipientCount === 0 ||
                  sendLoading ||
                  !templateId
                }
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendLoading
                  ? "Sending..."
                  : `Send emails to ${recipientCount ?? 0} users`}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirm}
        title="Confirm Email Send"
        message={
          <p>
            Are you sure you want to send Brevo template{" "}
            <strong>#{templateId}</strong> to{" "}
            <strong>{recipientCount}</strong> users in Tier {tier}? This action
            cannot be undone.
          </p>
        }
        onConfirm={handleSend}
        onCancel={() => setShowConfirm(false)}
        confirmText="Send Emails"
        isDestructive
      />
    </>
  );
}
