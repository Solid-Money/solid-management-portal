"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import DashboardNav from "@/components/dashboard-nav";
import SectionScroller from "@/components/section-scroller";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { useLiveCardTransactions } from "@/hooks/use-live-card-transactions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  // Card transaction views update as Rain and Wirex report changes.
  useLiveCardTransactions(!!user);

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
    <CommandPaletteProvider>
      <div className="min-h-screen bg-gray-100">
        <DashboardNav />
        <main className="mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
      {/* Lands on the section a search result or a pasted link names. */}
      <Suspense fallback={null}>
        <SectionScroller />
      </Suspense>
    </CommandPaletteProvider>
  );
}
