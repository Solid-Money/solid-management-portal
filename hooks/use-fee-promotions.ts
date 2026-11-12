"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import api, { unwrapData } from "@/lib/api";
import type {
  CreateFeePromotionBody,
  FeePromotion,
  FeePromotionList,
  UpdateFeePromotionBody,
} from "@/types/fee-promotions";

export const FEE_PROMOTION_KEYS = {
  list: ["fee-promotions"] as const,
};

/** Every fee promotion, with what each has given away and whether this admin can edit. */
export function useFeePromotions() {
  return useQuery<FeePromotionList>({
    queryKey: FEE_PROMOTION_KEYS.list,
    queryFn: async () =>
      unwrapData<FeePromotionList>(
        (await api.get("/admin/v1/fee-promotions")).data,
      ),
  });
}

/** Create a promotion, or change one when `id` is given. */
export function useSaveFeePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { id?: undefined; body: CreateFeePromotionBody }
        | { id: string; body: UpdateFeePromotionBody },
    ) =>
      unwrapData<FeePromotion>(
        input.id
          ? (
              await api.patch(
                `/admin/v1/fee-promotions/${encodeURIComponent(input.id)}`,
                input.body,
              )
            ).data
          : (await api.post("/admin/v1/fee-promotions", input.body)).data,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: FEE_PROMOTION_KEYS.list }),
  });
}
