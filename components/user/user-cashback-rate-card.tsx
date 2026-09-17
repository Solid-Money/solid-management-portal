"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Percent } from "lucide-react";
import { toast } from "sonner";

import { getUserRewards, setUserCashbackPercentage } from "@/lib/api";
import { formatCashbackRate } from "@/lib/cashback-percentage";
import { UserRewardsData } from "@/types";
import CashbackRateDialog from "@/components/cashback/cashback-rate-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserCashbackRateCardProps {
  userId: string;
  username: string;
  /** The rate pinned to this cardholder, from their user record. */
  cashbackPercentage?: number;
}

/**
 * The cardholder's cashback rate, and the control for changing it.
 *
 * Shows all three numbers rather than just the effective one, because "why is
 * this account on 8%?" is answered by the difference between them: the tier
 * default, the rate pinned to this cardholder, and what that adds up to. A
 * single figure would leave an operator unable to tell an override from a tier
 * they had forgotten about.
 *
 * A rate pinned to an individual transaction still outranks this one, and is
 * edited from the card transactions table instead — said here so nobody
 * concludes this panel is lying when one purchase pays something else.
 */
export default function UserCashbackRateCard({
  userId,
  username,
  cashbackPercentage,
}: UserCashbackRateCardProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ data: UserRewardsData }>({
    queryKey: ["user-rewards", userId],
    queryFn: async () => (await getUserRewards(userId)).data,
  });

  const rewards = data?.data;

  // The rewards endpoint reports percentages (3 for 3%); everything here works
  // in fractions, as the API that sets them does.
  const tierRate =
    rewards?.tierCashbackRate !== undefined
      ? rewards.tierCashbackRate / 100
      : rewards?.cashbackRate !== undefined
        ? rewards.cashbackRate / 100
        : undefined;
  const effectiveRate =
    rewards?.cashbackRate !== undefined ? rewards.cashbackRate / 100 : undefined;

  const hasOverride =
    cashbackPercentage !== undefined && cashbackPercentage !== null;

  const mutation = useMutation({
    mutationFn: ({
      percentage,
      reason,
    }: {
      percentage: number | null;
      reason?: string;
    }) => setUserCashbackPercentage(userId, percentage, reason),
    onSuccess: (_, variables) => {
      toast.success(
        variables.percentage === null
          ? `Cleared the cashback override for ${username}`
          : `${username} now earns ${formatCashbackRate(variables.percentage)} cashback`
      );
      setOpen(false);
      // The user record carries the override; the rewards panel carries what it
      // resolves to. Both move together.
      void queryClient.invalidateQueries({ queryKey: ["user", userId] });
      void queryClient.invalidateQueries({ queryKey: ["user-rewards", userId] });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast; this
      // only keeps the dialog open so the rate can be corrected and retried.
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-gray-400" />
          Cashback rate
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
          {hasOverride ? "Change" : "Set custom rate"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Earning
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  {formatCashbackRate(effectiveRate)}
                  {hasOverride && <Badge variant="info">custom</Badge>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Tier default
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {formatCashbackRate(tierRate)}
                  {rewards?.currentTier && (
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      {rewards.currentTier}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Override
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {hasOverride ? formatCashbackRate(cashbackPercentage) : "None"}
                </dd>
              </div>
            </dl>

            <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
              Applies to purchases from now on. Cashback already escrowed keeps
              the rate it was created at, and a rate set on a single transaction
              still beats this one — change those on the card spending table.
            </p>
          </div>
        )}
      </CardContent>

      {/* Mounted only while open so the field always seeds from what is set. */}
      {open && (
        <CashbackRateDialog
          open
          onOpenChange={setOpen}
          title={`Cashback rate for ${username}`}
          description={
            <>
              Overrides what their tier pays, on every purchase from now on.
              Cashback already escrowed keeps the rate it was created at.
            </>
          }
          current={hasOverride ? cashbackPercentage : null}
          fallback={tierRate}
          fallbackLabel={
            rewards?.currentTier
              ? `Their tier (${rewards.currentTier})`
              : "Their tier"
          }
          isSaving={mutation.isPending}
          onSubmit={(percentage, reason) =>
            mutation.mutate({ percentage, reason })
          }
        />
      )}
    </Card>
  );
}
