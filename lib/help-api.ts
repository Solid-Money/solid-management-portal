import api from "@/lib/api";
import type {
  HelpArticle,
  HelpArticleChanges,
  HelpArticleList,
  HelpArticleQuery,
  HelpCollection,
  HelpCollectionInput,
  HelpImage,
  HelpPreview,
  HelpRedirect,
  HelpVersion,
  HelpVersionSummary,
} from "@/types/help";

/**
 * The help center editor (`/admin/v1/support/help/*`), proxied by
 * admins-service to flash-support-service. Every portal admin can edit and
 * publish; each published version records who did it.
 */
const base = "/admin/v1/support/help";

export const listHelpArticles = async (query: HelpArticleQuery) =>
  (await api.get<HelpArticleList>(`${base}/articles`, { params: query })).data;

export const getHelpArticle = async (id: string) =>
  (await api.get<HelpArticle>(`${base}/articles/${id}`)).data;

export const createHelpArticle = async (input: {
  title: string;
  collectionId?: string | null;
  markdown?: string;
}) => (await api.post<HelpArticle>(`${base}/articles`, input)).data;

/** Saves the working copy. A 409 means someone saved since it was loaded; the caller shows that itself. */
export const updateHelpArticle = async (id: string, changes: HelpArticleChanges) =>
  (await api.patch<HelpArticle>(`${base}/articles/${id}`, changes, { quietErrors: true })).data;

export const publishHelpArticle = async (id: string, input: { note?: string; baseDraftUpdatedAt?: string }) =>
  (
    await api.post<HelpArticle & { unchanged: boolean }>(`${base}/articles/${id}/publish`, input, {
      quietErrors: true,
    })
  ).data;

export const helpArticleAction = async (id: string, action: "unpublish" | "archive" | "unarchive" | "verify") =>
  (await api.post<HelpArticle>(`${base}/articles/${id}/${action}`)).data;

export const listHelpVersions = async (id: string) =>
  (await api.get<HelpVersionSummary[]>(`${base}/articles/${id}/versions`)).data;

export const getHelpVersion = async (id: string, number: number) =>
  (await api.get<HelpVersion>(`${base}/articles/${id}/versions/${number}`)).data;

export const restoreHelpVersion = async (id: string, number: number) =>
  (await api.post<HelpArticle>(`${base}/articles/${id}/versions/${number}/restore`)).data;

export const listHelpCollections = async () =>
  (await api.get<HelpCollection[]>(`${base}/collections`)).data;

export const saveHelpCollection = async (input: HelpCollectionInput, id?: string) =>
  id
    ? (await api.put<HelpCollection>(`${base}/collections/${id}`, input)).data
    : (await api.post<HelpCollection>(`${base}/collections`, input)).data;

export const deleteHelpCollection = async (id: string) =>
  (await api.delete<{ deleted: true }>(`${base}/collections/${id}`)).data;

export const reorderHelp = async (kind: "articles" | "collections", items: Array<{ id: string; order: number }>) =>
  (await api.post<{ updated: number }>(`${base}/reorder`, { kind, items })).data;

/** The markdown as the public site renders it. Typing triggers it, so failures stay quiet. */
export const previewHelpMarkdown = async (markdown: string) =>
  (await api.post<HelpPreview>(`${base}/preview`, { markdown }, { quietErrors: true })).data;

export const uploadHelpImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<HelpImage>(`${base}/images`, form)).data;
};

export const listHelpRedirects = async () =>
  (await api.get<HelpRedirect[]>(`${base}/redirects`)).data;
