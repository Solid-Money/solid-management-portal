"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KolConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmText: string;
  pending: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The second step every consequential KOL action takes — switching a perk on
 * or off, removing a KOL, detaching a perk — so a misclick never changes what
 * signups get. Stays open while the save is out; closing is the caller's.
 */
export function KolConfirmDialog({
  open,
  title,
  children,
  confirmText,
  pending,
  destructive = false,
  onConfirm,
  onCancel,
}: KolConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-muted-foreground space-y-2 text-sm">
              {children}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
            className="cursor-pointer"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
