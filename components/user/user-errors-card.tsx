"use client";

import { CircleAlert, Loader2 } from "lucide-react";

import ClientErrorEntry from "@/components/client-error-entry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserClientErrors } from "@/hooks/use-client-errors";

/**
 * The failures the app showed this user, newest first: the answer to "what did
 * they run into?" before anyone has to ask them for a screenshot.
 */
export default function UserErrorsCard({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useUserClientErrors(userId);
  const errors = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleAlert className="h-4 w-4 text-gray-400" />
          Errors shown in the app
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          </div>
        ) : isError ? (
          <p className="text-xs text-red-600">The errors could not be loaded.</p>
        ) : errors.length === 0 ? (
          <p className="text-xs text-gray-500">
            No errors recorded for this user in the last 180 days.
          </p>
        ) : (
          <div className="space-y-3">
            {errors.map((error) => (
              <ClientErrorEntry key={error.id} error={error} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
