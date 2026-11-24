"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  NudgeMigrationApplyRequest,
  NudgeMigrationId,
  NudgeRestoreVersionRequest,
  NudgeSettingsUpdateRequest,
  NudgeTestRequest,
  NudgeUpdateRequest,
  NudgeView,
} from "@/types/nudges";

export const NUDGE_KEYS = {
  all: ["nudges"] as const,
  board: ["nudges", "board"] as const,
  detail: (key: string) => ["nudges", "detail", key] as const,
  history: ["nudges", "history"] as const,
  template: (id: number) => ["nudges", "template", id] as const,
  migrations: ["nudges", "migrations"] as const,
};

/** Every nudge, the rules and the catalog. */
export function useNudgeBoard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.board,
    queryFn: getNudgeBoard,
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

/** One nudge and its versions; only fetched while its editor is open. */
export function useNudgeDetail(key: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.detail(key ?? ""),
    queryFn: () => getNudgeDetail(key as string),
    enabled: !!user && !!key,
  });
}

/** Every change to nudges and rules, newest first. */
export function useNudgeHistory(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: NUDGE_KEYS.history,
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

/** After any nudge write: board, its detail and the history are stale. */
function useAfterNudgeWrite() {
  const queryClient = useQueryClient();
  return (saved?: NudgeView) => {
    if (saved) {
      queryClient.setQueryData<NudgeBoard>(NUDGE_KEYS.board, (board) =>
        replaceInBoard(board, saved)
      );
    }
    void queryClient.invalidateQueries({ queryKey: NUDGE_KEYS.all });
  };
}

export function useUpdateNudge() {
  const after = useAfterNudgeWrite();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: NudgeUpdateRequest }) =>
      updateNudge(key, input),
    retry: false,
    onSuccess: (saved) => after(saved),
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
  return useMutation({
    mutationFn: (input: NudgeSettingsUpdateRequest) =>
      updateNudgeSettings(input),
    retry: false,
    onSuccess: (settings) => {
      queryClient.setQueryData<NudgeBoard>(NUDGE_KEYS.board, (board) =>
        board ? { ...board, settings } : board
      );
      void queryClient.invalidateQueries({ queryKey: NUDGE_KEYS.all });
    },
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
