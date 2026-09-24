"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  DepositFeeChange,
  DepositFeeHistoryRow,
  DepositFeeMatrix,
  DepositFeeRoute,
} from "@/types/deposit-fees";

export const DEPOSIT_FEE_KEYS = {
  matrix: ["deposit-fees", "matrix"] as const,
  history: (route?: string, chainId?: number, limit?: number) =>
    ["deposit-fees", "history", route ?? "all", chainId ?? "all", limit] as const,
};

export function useDepositFeeMatrix() {
  return useQuery<DepositFeeMatrix>({
    queryKey: DEPOSIT_FEE_KEYS.matrix,
    queryFn: async () => (await api.get("/admin/v1/deposit-fees")).data,
  });
}

export function useSaveDepositFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version: number;
      changes: DepositFeeChange[];
      note?: string;
    }) => (await api.put("/admin/v1/deposit-fees", input)).data,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["deposit-fees"] }),
  });
}

/** The two deposit fee line switches, which live on the product-fee config. */
export function useSetDepositFeeLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      line: "card" | "savings";
      enabled: boolean;
    }) =>
      api.patch("/admin/v1/rewards-config/card-fees", {
        [input.line === "card"
          ? "cardDepositBridgeEnabled"
          : "savingsDepositBridgeEnabled"]: input.enabled,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: DEPOSIT_FEE_KEYS.matrix }),
  });
}

export function useDepositFeeHistory(params: {
  route?: DepositFeeRoute;
  chainId?: number;
  limit: number;
}) {
  return useQuery<DepositFeeHistoryRow[]>({
    queryKey: DEPOSIT_FEE_KEYS.history(
      params.route,
      params.chainId,
      params.limit,
    ),
    queryFn: async () =>
      (
        await api.get("/admin/v1/deposit-fees/history", {
          params: {
            route: params.route,
            chainId: params.chainId,
            limit: params.limit,
          },
        })
      ).data,
  });
}
