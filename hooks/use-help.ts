"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteHelpCollection,
  getHelpArticle,
  getHelpImport,
  getHelpVersion,
  helpArticleAction,
  listHelpArticles,
  listHelpCollections,
  listHelpVersions,
  previewHelpMarkdown,
  reorderHelp,
  restoreHelpVersion,
  saveHelpCollection,
  startHelpImport,
} from "@/lib/help-api";
import type { HelpArticle, HelpArticleQuery, HelpCollectionInput, HelpImportOptions } from "@/types/help";

export const HELP_KEYS = {
  all: ["help"] as const,
  articles: (query: HelpArticleQuery) => ["help", "articles", query] as const,
  article: (id: string) => ["help", "article", id] as const,
  versions: (id: string) => ["help", "versions", id] as const,
  version: (id: string, number: number) => ["help", "version", id, number] as const,
  collections: ["help", "collections"] as const,
  preview: (markdown: string) => ["help", "preview", markdown] as const,
  import: ["help-import"] as const,
};

export function useHelpArticles(query: HelpArticleQuery) {
  return useQuery({
    queryKey: HELP_KEYS.articles(query),
    queryFn: () => listHelpArticles(query),
    placeholderData: keepPreviousData,
  });
}

export function useHelpArticle(id: string) {
  return useQuery({
    queryKey: HELP_KEYS.article(id),
    queryFn: () => getHelpArticle(id),
    // The editor keeps its own copy; refetching under it would be confusing.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useHelpCollections() {
  return useQuery({ queryKey: HELP_KEYS.collections, queryFn: listHelpCollections });
}

export function useHelpVersions(id: string) {
  return useQuery({ queryKey: HELP_KEYS.versions(id), queryFn: () => listHelpVersions(id) });
}

export function useHelpVersion(id: string, number: number | null) {
  return useQuery({
    queryKey: HELP_KEYS.version(id, number ?? 0),
    queryFn: () => getHelpVersion(id, number!),
    enabled: number !== null,
  });
}

/** The value, once it has stopped changing for `ms`. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** The server's rendering of the markdown, refreshed as the author pauses. */
export function useHelpPreview(markdown: string) {
  const settled = useDebouncedValue(markdown, 350);
  return useQuery({
    queryKey: HELP_KEYS.preview(settled),
    queryFn: () => previewHelpMarkdown(settled),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}

/** After a write: refresh lists, and put the returned article in the cache. */
export function useHelpArticleWrites() {
  const queryClient = useQueryClient();
  return (article: HelpArticle) => {
    queryClient.setQueryData(HELP_KEYS.article(article.id), article);
    void queryClient.invalidateQueries({ queryKey: ["help", "articles"] });
    void queryClient.invalidateQueries({ queryKey: HELP_KEYS.versions(article.id) });
    void queryClient.invalidateQueries({ queryKey: HELP_KEYS.collections });
  };
}

export function useHelpArticleAction(id: string) {
  const written = useHelpArticleWrites();
  return useMutation({
    mutationFn: (action: "unpublish" | "archive" | "unarchive" | "verify") => helpArticleAction(id, action),
    onSuccess: written,
  });
}

export function useRestoreHelpVersion(id: string) {
  const written = useHelpArticleWrites();
  return useMutation({
    mutationFn: (number: number) => restoreHelpVersion(id, number),
    onSuccess: written,
  });
}

export function useSaveHelpCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HelpCollectionInput & { id?: string }) => {
      const { id, ...body } = input;
      return saveHelpCollection(body, id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: HELP_KEYS.all }),
  });
}

export function useDeleteHelpCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHelpCollection(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: HELP_KEYS.all }),
  });
}

export function useReorderHelp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: "articles" | "collections"; items: Array<{ id: string; order: number }> }) =>
      reorderHelp(input.kind, input.items),
    onSettled: () => queryClient.invalidateQueries({ queryKey: HELP_KEYS.all }),
  });
}

/** The latest Intercom import, polled every 2 s while one is running. Only fetched while `enabled`. */
export function useHelpImport(enabled: boolean) {
  return useQuery({
    queryKey: HELP_KEYS.import,
    queryFn: getHelpImport,
    enabled,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });
}

/** Starts an import or a preview; the status query picks it up from there. */
export function useStartHelpImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: HelpImportOptions) => startHelpImport(options),
    onSuccess: (run) => queryClient.setQueryData(HELP_KEYS.import, run),
  });
}
