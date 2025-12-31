"use client";

import React, { useMemo, useState } from "react";
import { Activity } from "@/types";
import { groupTransactionsByTime, ActivityGroup, TimeGroupHeaderData, cn } from "@/lib/utils";
import { ActivityItem } from "./activity/activity-item";
import { ActivityGroupHeader } from "./activity/activity-group-header";
import { RefreshCcw, Filter } from "lucide-react";

export default function ActivityList({
  activities,
}: {
  activities: Activity[];
}) {
  const [showStuck, setShowStuck] = useState(false);

  const groupedActivities = useMemo(() => {
    // Sort activities descending (newest first) before grouping
    const sorted = [...activities].sort((a, b) => {
      const timeA = a.timestamp ? parseInt(a.timestamp) * 1000 : new Date(a.createdAt).getTime();
      const timeB = b.timestamp ? parseInt(b.timestamp) * 1000 : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    return groupTransactionsByTime(sorted, showStuck);
  }, [activities, showStuck]);

  return (
    <div className="bg-white shadow-sm overflow-hidden sm:rounded-xl border border-gray-100 h-full flex flex-col">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gray-50/50 shrink-0">
        <h3 className="text-lg leading-6 font-semibold text-gray-900">
          Recent Activity
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStuck(!showStuck)}
            className={cn(
              "p-2 rounded-lg transition-colors border",
              showStuck 
                ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
            title={showStuck ? "Showing all" : "Showing user view"}
          >
            <Filter className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {activities.length} transactions
          </span>
        </div>
      </div>
      <div className="border-t border-gray-100 overflow-y-auto flex-1">
        {activities.length === 0 ? (
          <div className="p-12 text-gray-400 text-center flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <span className="text-2xl">📁</span>
            </div>
            <p className="text-sm font-medium">No activity found for this user</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {groupedActivities.map((group, index) => {
              if (group.type === ActivityGroup.HEADER) {
                const headerData = group.data as TimeGroupHeaderData;
                return (
                  <ActivityGroupHeader
                    key={headerData.key}
                    title={headerData.title}
                    isPending={headerData.status === "pending"}
                  />
                );
              }

              const activity = group.data as Activity;
              
              // Determine if this is the first or last in its visual group (between headers)
              let isFirstInGroup = false;
              let isLastInGroup = false;

              // Check if previous item was a header or if it's the first item overall
              if (index === 0 || groupedActivities[index - 1].type === ActivityGroup.HEADER) {
                isFirstInGroup = true;
              }

              // Check if next item is a header or if it's the last item overall
              if (index === groupedActivities.length - 1 || groupedActivities[index + 1].type === ActivityGroup.HEADER) {
                isLastInGroup = true;
              }

              return (
                <div key={activity.id || activity._id} className="px-4 py-1">
                  <ActivityItem
                    activity={activity}
                    isFirst={isFirstInGroup}
                    isLast={isLastInGroup}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
