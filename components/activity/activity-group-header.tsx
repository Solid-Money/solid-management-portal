"use client";

import React from "react";

interface ActivityGroupHeaderProps {
  title: string;
  isPending?: boolean;
}

export const ActivityGroupHeader = ({
  title,
}: ActivityGroupHeaderProps) => {
  return (
    <div className="flex items-center justify-between py-4 px-4 sticky top-0 bg-white/80 backdrop-blur-sm z-10">
      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        {title}
      </h4>
    </div>
  );
};



