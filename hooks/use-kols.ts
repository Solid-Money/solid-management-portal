import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { unwrapData } from "@/lib/api";
import type {
  CreateKolPerkBody,
  Kol,
  KolPerk,
  KolPerkGrantList,
  KolsOverview,
  UpdateKolPerkBody,
} from "@/types/kols";

/**
 * Growth → KOLs. Every save invalidates the overview, so the KOL list, the
 * perk list and their stats always come back together from one read.
 */
export const KOL_KEYS = {
  overview: ["kols"] as const,
  grants: (kind: "perk" | "kol", id: string) =>
    ["kols", "grants", kind, id] as const,
};

export function useKols() {
  return useQuery<KolsOverview>({
    queryKey: KOL_KEYS.overview,
    queryFn: async () =>
      unwrapData<KolsOverview>((await api.get("/admin/v1/kols")).data),
  });
}

/** The users who used a perk's code, or any of a KOL's perk codes. */
export function useKolGrants(kind: "perk" | "kol", id: string | null) {
  return useQuery<KolPerkGrantList>({
    queryKey: KOL_KEYS.grants(kind, id ?? ""),
    enabled: !!id,
    queryFn: async () =>
      unwrapData<KolPerkGrantList>(
        (
          await api.get(
            kind === "perk"
              ? `/admin/v1/kols/perks/${encodeURIComponent(id ?? "")}/grants`
              : `/admin/v1/kols/${encodeURIComponent(id ?? "")}/grants`,
          )
        ).data,
      ),
  });
}

function useOverviewMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: KOL_KEYS.overview }),
  });
}

export function useAddKol() {
  return useOverviewMutation(async (body: { username: string; note?: string }) =>
    unwrapData<Kol>((await api.post("/admin/v1/kols", body)).data),
  );
}

export function useUpdateKol() {
  return useOverviewMutation(
    async (input: { id: string; version: number; note: string }) =>
      unwrapData<Kol>(
        (
          await api.patch(`/admin/v1/kols/${encodeURIComponent(input.id)}`, {
            version: input.version,
            note: input.note,
          })
        ).data,
      ),
  );
}

export function useRemoveKol() {
  return useOverviewMutation(async (input: { id: string; version: number }) =>
    unwrapData<Kol>(
      (
        await api.post(
          `/admin/v1/kols/${encodeURIComponent(input.id)}/remove`,
          { version: input.version },
        )
      ).data,
    ),
  );
}

/** Create a perk, or change one when `id` is given. */
export function useSaveKolPerk() {
  return useOverviewMutation(
    async (
      input:
        | { id?: undefined; body: CreateKolPerkBody }
        | { id: string; body: UpdateKolPerkBody },
    ) =>
      unwrapData<KolPerk>(
        input.id
          ? (
              await api.patch(
                `/admin/v1/kols/perks/${encodeURIComponent(input.id)}`,
                input.body,
              )
            ).data
          : (await api.post("/admin/v1/kols/perks", input.body)).data,
      ),
  );
}

/** Attach a perk to a KOL, or detach it (`kolId: null`). */
export function useAttachKolPerk() {
  return useOverviewMutation(
    async (input: { id: string; version: number; kolId: string | null }) =>
      unwrapData<KolPerk>(
        (
          await api.post(
            `/admin/v1/kols/perks/${encodeURIComponent(input.id)}/attach`,
            { version: input.version, kolId: input.kolId },
          )
        ).data,
      ),
  );
}

/** A code no user or perk holds yet, built from `seed`. */
export async function suggestKolPerkCode(seed: string): Promise<string> {
  const result = unwrapData<{ code: string }>(
    (await api.post("/admin/v1/kols/perks/code-suggestion", { seed })).data,
  );
  return result.code;
}
