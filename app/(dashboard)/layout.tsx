"use client";

import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import DashboardNav from "@/components/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return null; // Will be redirected by AuthProvider
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardNav />
      <main className="mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
