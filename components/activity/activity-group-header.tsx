"use client";

import React from "react";
import { TransactionStatus } from "@/types";
import { Loader2 } from "lucide-react";

interface ActivityGroupHeaderProps {
  title: string;
  isPending?: boolean;
}

export const ActivityGroupHeader = ({
  title,
  isPending,
}: ActivityGroupHeaderProps) => {
  return (
    <div className="flex items-center justify-between py-4 px-4 sticky top-0 bg-white/80 backdrop-blur-sm z-10">
      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        {title}
      </h4>
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
      )}
    </div>
  );
};



