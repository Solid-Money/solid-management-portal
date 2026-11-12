"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";

import { HiddenActivityRestore } from "@/components/scripts/hidden-activity-restore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "I sent it and it doesn't show": rows the token whitelist hid as spam,
 * though they went through on chain. Previews this user's hidden rows that
 * qualify and puts them back. Spam, card settlement sweeps and deposit legs
 * stay hidden; the server decides, and records the restore on the user's
 * audit trail.
 */
export default function RestoreHiddenActivityDialog({
  userId,
}: {
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restore hidden activity
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Remounted on each open, so a stale preview is never shown. */}
        {open && (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Restore hidden activity</DialogTitle>
              <DialogDescription>
                Finds this user&apos;s sends and Earn withdrawals that were
                hidden as spam although they went through on chain (soFUSE,
                soETH, USDT on Fuse, soUSD on Base), and puts them back in their
                activity.
              </DialogDescription>
            </DialogHeader>
            <HiddenActivityRestore
              userId={userId}
              onRestored={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["user-activity", userId],
                });
                void queryClient.invalidateQueries({
                  queryKey: ["user-audit-log", userId],
                });
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
