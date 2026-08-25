"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search, User as UserIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  NAV_GROUPS,
  isActiveGroup,
  isActivePath,
  type NavGroup,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Jump straight to a user from anywhere — the most common support entry point. */
function UserQuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/users?search=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className="relative hidden lg:block">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find a user…"
        aria-label="Find a user by name, email, address or referral code"
        className="h-9 w-56 pl-8"
      />
    </form>
  );
}

function GroupSubmenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(
          isActiveGroup(pathname, group) &&
            "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
        )}
      >
        <group.icon className="mr-2 h-4 w-4" />
        {group.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[22rem] gap-1 p-2">
          {group.items?.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <NavigationMenuLink asChild>
                  <Link
                    href={item.href}
                    data-active={active || undefined}
                    className="flex-row items-start gap-3"
                  >
                    <item.icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        active && "text-indigo-600"
                      )}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span
                        className={cn(
                          "font-medium leading-none",
                          active && "text-indigo-700"
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="text-muted-foreground text-xs leading-snug">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </NavigationMenuLink>
              </li>
            );
          })}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

/** Every link in one dropdown, for viewports too narrow for the menu bar. */
function MobileNav({ pathname }: { pathname: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label}>
            {index > 0 && <DropdownMenuSeparator />}
            {group.href ? (
              <DropdownMenuItem asChild>
                <Link href={group.href} className="cursor-pointer">
                  <group.icon className="h-4 w-4" />
                  <span
                    className={cn(
                      isActivePath(pathname, group.href) &&
                        "font-semibold text-indigo-700"
                    )}
                  >
                    {group.label}
                  </span>
                </Link>
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuLabel className="text-muted-foreground text-xs uppercase">
                  {group.label}
                </DropdownMenuLabel>
                {group.items?.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="cursor-pointer">
                      <item.icon className="h-4 w-4" />
                      <span
                        className={cn(
                          isActivePath(pathname, item.href) &&
                            "font-semibold text-indigo-700"
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardNav() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  const handleSignOut = async () => {
    setIsSignOutModalOpen(false);
    await signOut();
  };

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
          <MobileNav pathname={pathname} />

          <Link href="/users" className="shrink-0 text-xl font-bold text-indigo-600">
            Solid Admin
          </Link>

          <NavigationMenu className="hidden md:flex" viewport={false}>
            <NavigationMenuList>
              {NAV_GROUPS.map((group) =>
                group.href ? (
                  <NavigationMenuItem key={group.label}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={group.href}
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "flex-row items-center",
                          isActivePath(pathname, group.href) &&
                            "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                        )}
                      >
                        <group.icon className="mr-2 h-4 w-4" />
                        {group.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ) : (
                  <GroupSubmenu
                    key={group.label}
                    group={group}
                    pathname={pathname}
                  />
                )
              )}
            </NavigationMenuList>
          </NavigationMenu>

          <div className="ml-auto flex items-center gap-3">
            <UserQuickSearch />
            <span className="hidden items-center text-sm text-gray-600 xl:flex">
              <UserIcon className="mr-2 h-4 w-4" />
              {user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSignOutModalOpen(true)}
              className="cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </nav>

      <ConfirmationModal
        isOpen={isSignOutModalOpen}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setIsSignOutModalOpen(false)}
      />
    </>
  );
}
