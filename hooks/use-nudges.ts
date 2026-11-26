"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { useAuth } from "@/components/auth-provider";
import {
  applyNudgeMigration,
  createNudge,
  dryRunNudgeMigration,
  getNudgeBoard,
  getNudgeDetail,
  getNudgeHistory,
  getNudgeMigrations,
  getNudgeTemplate,
  restoreNudgeVersion,
  sendNudgeTest,
  updateNudge,
  updateNudgeSettings,
} from "@/lib/nudges-api";
import type {
  NudgeBoard,
  NudgeCreateRequest,
  NudgeDetail,
  NudgeMigrationApplyRequest,
  NudgeMigrationId,
  NudgeRestoreVersionRequest,
  NudgeSettingsUpdateRequest,
  NudgeTestRequest,
  NudgeUpdateRequest,
  NudgeView,
} from "@/types/nudges";

/**
 * Query keys. What depends on who is asking (edit rights, the admin's view of
 * the board) is keyed by the signed-in admin, so a second admin signing in on
 * the same tab never sees the first one's cached answer. Everything sits under
 * `all`, so one invalidation still covers it.
 */
export const NUDGE_KEYS = {
  all: ["nudges"] as const,
  board: (uid: string) => ["nudges", uid, "board"] as const,
  detail: (uid: string, key: string) => ["nudges", uid, "detail", key] as const,
  history: (uid: string) => ["nudges", uid, "history"] as const,
  template: (id: number) => ["nudges", "template", id] as const,
  migrations: ["nudges", "migrations"] as const,
};

/** Whether a write was refused because someone saved first. */
export function isVersionConflict(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409;
}

/** Every nudge, the rules and the catalog. */
export function useNudgeBoard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.board(user?.uid ?? ""),
    queryFn: getNudgeBoard,
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

/** One nudge and its versions; only fetched while its editor is open. */
export function useNudgeDetail(key: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.detail(user?.uid ?? "", key ?? ""),
    queryFn: () => getNudgeDetail(key as string),
    enabled: !!user && !!key,
  });
}

/** Every change to nudges and rules, newest first. */
export function useNudgeHistory(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.history(user?.uid ?? ""),
    queryFn: () => getNudgeHistory(100),
    enabled: !!user && enabled,
  });
}

/** A Brevo template, read live, once an id is asked for. */
export function useNudgeTemplate(id: number | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.template(id ?? 0),
    queryFn: () => getNudgeTemplate(id as number),
    enabled: !!user && id !== null && id > 0,
    retry: false,
    staleTime: 60 * 1000,
  });
}

/** The nudge migrations listed on Scripts. */
export function useNudgeMigrations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.migrations,
    queryFn: getNudgeMigrations,
    enabled: !!user,
  });
}

/** Put the saved nudge into the board cache so the graph updates at once. */
function replaceInBoard(
  board: NudgeBoard | undefined,
  saved: NudgeView
): NudgeBoard | undefined {
  if (!board) return board;
  const exists = board.nudges.some((n) => n.key === saved.key);
  return {
    ...board,
    nudges: exists
      ? board.nudges.map((n) => (n.key === saved.key ? saved : n))
      : [...board.nudges, saved],
  };
}

/**
 * After any nudge write: put the saved nudge into the board and its detail at
 * once (so an open editor moves to the saved version even if the refetch
 * fails), then refresh everything, the versions and history included.
 */
function useAfterNudgeWrite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return (saved?: NudgeView) => {
    if (saved) {
      queryClient.setQueryData<NudgeBoard>(NUDGE_KEYS.board(uid), (board) =>
        replaceInBoard(board, saved)
      );
      queryClient.setQueryData<NudgeDetail>(
        NUDGE_KEYS.detail(uid, saved.key),
        (detail) => (detail ? { ...detail, nudge: saved } : detail)
      );
    }
    void queryClient.invalidateQueries({ queryKey: NUDGE_KEYS.all });
  };
}

/** On a version conflict, fetch what is saved now so the admin can re-apply. */
function useRefreshOnConflict() {
  const queryClient = useQueryClient();
  return (error: unknown) => {
    if (isVersionConflict(error)) {
      void queryClient.invalidateQueries({ queryKey: NUDGE_KEYS.all });
    }
  };
}

export function useUpdateNudge() {
  const after = useAfterNudgeWrite();
  const refreshOnConflict = useRefreshOnConflict();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: NudgeUpdateRequest }) =>
      updateNudge(key, input),
    retry: false,
    onSuccess: (saved) => after(saved),
    onError: refreshOnConflict,
  });
}

export function useCreateNudge() {
  const after = useAfterNudgeWrite();
  return useMutation({
    mutationFn: (input: NudgeCreateRequest) => createNudge(input),
    retry: false,
    onSuccess: (saved) => after(saved),
  });
}

export function useRestoreNudgeVersion() {
  const after = useAfterNudgeWrite();
  return useMutation({
    mutationFn: ({
      key,
      version,
      input,
    }: {
      key: string;
      version: number;
      input: NudgeRestoreVersionRequest;
    }) => restoreNudgeVersion(key, version, input),
    retry: false,
    onSuccess: (saved) => after(saved),
  });
}

export function useUpdateNudgeSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const refreshOnConflict = useRefreshOnConflict();
  return useMutation({
    mutationFn: (input: NudgeSettingsUpdateRequest) =>
      updateNudgeSettings(input),
    retry: false,
    onSuccess: (settings) => {
      queryClient.setQueryData<NudgeBoard>(
        NUDGE_KEYS.board(user?.uid ?? ""),
        (board) => (board ? { ...board, settings } : board)
      );
      void queryClient.invalidateQueries({ queryKey: NUDGE_KEYS.all });
    },
    onError: refreshOnConflict,
  });
}

/** Never retried: a retry would send the test a second time. */
export function useSendNudgeTest() {
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: NudgeTestRequest }) =>
      sendNudgeTest(key, input),
    retry: false,
  });
}

export function useDryRunNudgeMigration() {
  return useMutation({
    mutationFn: (id: NudgeMigrationId) => dryRunNudgeMigration(id),
    retry: false,
  });
}

export function useApplyNudgeMigration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: NudgeMigrationId;
      input: NudgeMigrationApplyRequest;
    }) => applyNudgeMigration(id, input),
    retry: false,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: NUDGE_KEYS.all }),
  });
}
