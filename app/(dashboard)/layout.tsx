"use client";

import {
  User,
  LogOut,
  Users,
  Activity,
  Wallet,
  CreditCard,
  Sparkles,
  BarChart3,
  Gift,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  const handleSignOut = async () => {
    setIsSignOutModalOpen(false);
      await signOut();
  };

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

  const navItems = [
    { href: "/users", label: "Users", icon: Users },
    { href: "/activity", label: "Activity", icon: Activity },
    {
      href: "/card-transactions",
      label: "Card Transactions",
      icon: CreditCard,
    },
    { href: "/wallets", label: "Wallets", icon: Wallet },
    { href: "/rewards-config", label: "Rewards", icon: Gift },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/whats-new", label: "What's New", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="shrink-0 flex items-center">
                <span className="text-xl font-bold text-indigo-600">
                  Solid Admin
                </span>
              </div>
              <div className="hidden sm:flex sm:space-x-4">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? "bg-indigo-100 text-indigo-700"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-700">
                <User className="h-4 w-4 mr-2" />
                {user?.email}
              </div>
              <button
                onClick={() => setIsSignOutModalOpen(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>

      <ConfirmationModal
        isOpen={isSignOutModalOpen}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setIsSignOutModalOpen(false)}
      />
    </div>
  );
}
