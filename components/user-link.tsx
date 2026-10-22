"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

interface UserLinkProps {
  userId?: string | null;
  username?: string | null;
  /**
   * What someone typed into a sign-in form, for rows with no account behind
   * them. Display only — it is whatever was typed, not who they are.
   */
  claimedUsername?: string | null;
  className?: string;
}

/**
 * A user, as a link to their page, or as the best that can be said about them
 * when there is no account to link to.
 *
 * Stops click propagation, so it can sit inside a row that opens something
 * else when clicked.
 */
export default function UserLink({
  userId,
  username,
  claimedUsername,
  className,
}: UserLinkProps) {
  if (userId) {
    return (
      <Link
        href={`/users/${userId}`}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "text-indigo-600 hover:text-indigo-800 hover:underline font-medium",
          className
        )}
        title={username ? undefined : userId}
      >
        {username || `${userId.slice(0, 8)}…`}
      </Link>
    );
  }

  return (
    <span className={cn("text-gray-400 italic", className)}>
      {claimedUsername ? `typed: ${claimedUsername}` : "Unknown user"}
    </span>
  );
}
