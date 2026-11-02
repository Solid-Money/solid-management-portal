"use client";

import { KeyRound } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActionPolicy } from "@/hooks/use-admin-access";
import { describeRequirement } from "@/lib/admin-access";
import { cn } from "@/lib/utils";

/**
 * A key on a button whose action needs another admin's approval before it
 * runs, with who has to give it. Read from the live rules, so it appears and
 * disappears as a rule is changed — put it on any button by naming the action
 * it calls (`POST /users/:id/card/freeze`).
 */
export default function ApprovalKey({
  action,
  className,
}: {
  action: string;
  className?: string;
}) {
  const policy = useActionPolicy(action);
  const { access } = useAuth();
  if (!policy || policy.requiredApprovals < 1) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <KeyRound
          className={cn("h-3.5 w-3.5 shrink-0 text-amber-600", className)}
          aria-label="Needs approval"
          role="img"
        />
      </TooltipTrigger>
      <TooltipContent>
        Needs {describeRequirement(
          policy.requiredApprovals,
          policy.approverRank,
          access?.rank
        )}{" "}
        before it runs
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The line a dialog shows above its confirm button when the action will be
 * sent for approval instead of running, so nobody expects it to be done.
 */
export function ApprovalNotice({ action }: { action: string }) {
  const policy = useActionPolicy(action);
  const { access } = useAuth();
  if (!policy || policy.requiredApprovals < 1) return null;

  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        This is sent for approval rather than run now. It runs once it has{" "}
        {describeRequirement(
          policy.requiredApprovals,
          policy.approverRank,
          access?.rank
        )}
        ; follow it under Activity → Approvals.
      </span>
    </p>
  );
}
