"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  Bold,
  CheckCircle2,
  ExternalLink,
  FileText,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  MoreHorizontal,
  Quote,
  Table,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import SupportMeGate from "@/components/support/support-me-gate";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ArticleLinkDialog from "@/components/help/article-link-dialog";
import { orderedCollections } from "@/components/help/collections-dialog";
import { ArticleStatus, FeedbackScore, personName, shortDate } from "@/components/help/help-format";
import { insertBlock, prefixLines, TABLE_TEMPLATE, type TextEdit, wrapSelection } from "@/components/help/markdown-edit";
import VersionsPanel from "@/components/help/versions-panel";
import {
  useHelpArticle,
  useHelpArticleAction,
  useHelpArticleWrites,
  useHelpCollections,
  useHelpPreview,
  useRestoreHelpVersion,
} from "@/hooks/use-help";
import { publishHelpArticle, updateHelpArticle, uploadHelpImage } from "@/lib/help-api";
import { cn } from "@/lib/utils";
import { HELP_AUDIENCE_LABELS, HELP_AUDIENCES, type HelpArticle, type HelpArticleChanges, type HelpAudience } from "@/types/help";

interface Draft {
  title: string;
  slug: string;
  description: string;
  markdown: string;
  audience: HelpAudience;
  collectionId: string;
  ownerEmail: string;
}

function toDraft(article: HelpArticle): Draft {
  return {
    title: article.title,
    slug: article.slug,
    description: article.description,
    markdown: article.markdown,
    audience: article.audience,
    collectionId: article.collectionId ?? "",
    ownerEmail: article.ownerEmail ?? "",
  };
}

/** What differs from the saved article, as the API wants it. */
function changesOf(draft: Draft, saved: HelpArticle): HelpArticleChanges {
  const changes: HelpArticleChanges = {};
  if (draft.title.trim() !== saved.title) changes.title = draft.title.trim();
  if (draft.slug !== saved.slug) changes.slug = draft.slug;
  if (draft.description.trim() !== saved.description) changes.description = draft.description.trim();
  if (draft.markdown !== saved.markdown) changes.markdown = draft.markdown;
  if (draft.audience !== saved.audience) changes.audience = draft.audience;
  if (draft.collectionId !== (saved.collectionId ?? "")) changes.collectionId = draft.collectionId || null;
  const owner = draft.ownerEmail.trim().toLowerCase();
  if (owner !== (saved.ownerEmail ?? "")) changes.ownerEmail = owner || null;
  return changes;
}

function apiMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return "Something went wrong";
}

function altFrom(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/[[\]]/g, "").trim() || "Image";
}

const TOOLBAR_BUTTON = "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900";

function Editor({ initial }: { initial: HelpArticle }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"archive" | "unpublish" | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const written = useHelpArticleWrites();
  const action = useHelpArticleAction(saved.id);
  const restore = useRestoreHelpVersion(saved.id);
  const { data: collections = [] } = useHelpCollections();
  const ordered = useMemo(() => orderedCollections(collections), [collections]);
  const { data: preview, isFetching: previewing } = useHelpPreview(draft.markdown);

  const changes = useMemo(() => changesOf(draft, saved), [draft, saved]);
  const dirty = Object.keys(changes).length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const accept = useCallback(
    (article: HelpArticle) => {
      setSaved(article);
      written(article);
    },
    [written],
  );

  const save = useCallback(async (): Promise<HelpArticle | null> => {
    if (!dirty) return saved;
    if (!draft.title.trim()) {
      toast.error("Add a title first");
      return null;
    }
    setSaving(true);
    try {
      const updated = await updateHelpArticle(saved.id, { ...changes, baseDraftUpdatedAt: saved.draftUpdatedAt });
      accept(updated);
      return updated;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && /saved this article/i.test(apiMessage(error))) {
        setConflict(true);
      }
      toast.error(apiMessage(error));
      return null;
    } finally {
      setSaving(false);
    }
  }, [accept, changes, dirty, draft.title, saved]);

  const publish = async () => {
    setPublishing(true);
    try {
      const current = await save();
      if (!current) return;
      const result = await publishHelpArticle(current.id, {
        ...(note.trim() ? { note: note.trim() } : {}),
        baseDraftUpdatedAt: current.draftUpdatedAt,
      });
      accept(result);
      setPublishOpen(false);
      setNote("");
      toast.success(result.unchanged ? "Nothing new to publish" : `Published version ${result.liveVersion}`);
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  const runAction = (name: "unpublish" | "archive" | "unarchive" | "verify", done: string) =>
    action.mutate(name, {
      onSuccess: (article) => {
        setSaved(article);
        toast.success(done);
      },
    });

  // Cmd/Ctrl+S saves; leaving with unsaved changes asks first.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  /** Apply a toolbar edit to the text as it is now, then restore the selection. */
  const apply = (edit: (current: TextEdit) => TextEdit) => {
    const element = textarea.current;
    if (!element) return;
    const result = edit({
      value: element.value,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd,
    });
    set("markdown", result.value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const uploadImages = async (files: File[]) => {
    for (const file of files.filter((candidate) => candidate.type.startsWith("image/"))) {
      const toastId = toast.loading(`Uploading ${file.name}…`);
      try {
        const image = await uploadHelpImage(file);
        apply((current) => insertBlock(current, `![${altFrom(file.name)}](${image.path})`));
        toast.success("Image added", { id: toastId });
      } catch {
        toast.dismiss(toastId);
      }
    }
  };

  const onEditorKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      apply((current) => wrapSelection(current, "**", "**", "bold text"));
    } else if (key === "i") {
      event.preventDefault();
      apply((current) => wrapSelection(current, "*", "*", "italic text"));
    } else if (key === "k") {
      event.preventDefault();
      apply((current) => wrapSelection(current, "[", "](https://)", "link text"));
    }
  };

  const published = saved.status === "published";
  const slugChanged = draft.slug !== saved.slug;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/support/articles" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Help Center
        </Link>
        <ArticleStatus article={saved} />
        <span className="text-xs text-gray-500">
          {saving ? "Saving…" : dirty ? "Unsaved changes" : `Saved ${shortDate(saved.updatedAt)} by ${personName(saved.updatedBy)}`}
        </span>
        <span className="flex-1" />
        <div className="flex rounded-md border border-gray-200 bg-white p-0.5 xl:hidden">
          {(["write", "preview"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "cursor-pointer rounded px-3 py-1 text-sm capitalize",
                mode === value ? "bg-gray-900 text-white" : "text-gray-600",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => void save()} disabled={!dirty || saving || saved.archived}>
          {saving && <Loader2 className="animate-spin" />} Save
        </Button>
        <Button onClick={() => setPublishOpen(true)} disabled={saved.archived || publishing}>
          <Upload /> {published ? "Publish changes" : "Publish"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {saved.publicUrl && (
              <DropdownMenuItem asChild>
                <a href={saved.publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> View on the site
                </a>
              </DropdownMenuItem>
            )}
            {!saved.archived && (
              <DropdownMenuItem onSelect={() => runAction("verify", "Marked as verified")}>
                <CheckCircle2 /> Mark as verified today
              </DropdownMenuItem>
            )}
            {published && (
              <DropdownMenuItem onSelect={() => setConfirm("unpublish")}>
                <FileText /> Unpublish
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {saved.archived ? (
              <DropdownMenuItem onSelect={() => runAction("unarchive", "Restored as a draft")}>Restore from archive</DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="text-red-700" onSelect={() => setConfirm("archive")}>
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {conflict && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Someone saved this article after you opened it. Copy anything you want to keep, then reload to see their version.
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      )}
      {saved.archived && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          This article is archived: it is off the site, the app and Solid AI. Restore it to edit.
        </div>
      )}

      <input
        aria-label="Title"
        value={draft.title}
        maxLength={150}
        placeholder="Title"
        onChange={(event) => set("title", event.target.value)}
        className="w-full rounded-md bg-transparent px-1 text-2xl font-semibold text-gray-900 outline-none focus:bg-white"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
        <section className={cn("flex min-h-[70vh] flex-col rounded-lg bg-white shadow-sm", mode === "preview" && "hidden xl:flex")}>
          <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-2 py-1">
            <button type="button" className={TOOLBAR_BUTTON} title="Bold (⌘B)" onClick={() => apply((c) => wrapSelection(c, "**", "**", "bold text"))}>
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Italic (⌘I)" onClick={() => apply((c) => wrapSelection(c, "*", "*", "italic text"))}>
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Section heading" onClick={() => apply((c) => prefixLines(c, "# "))}>
              <Heading2 className="h-4 w-4" />
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Sub-heading" onClick={() => apply((c) => prefixLines(c, "## "))}>
              <Heading3 className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <button type="button" className={TOOLBAR_BUTTON} title="Bulleted list" onClick={() => apply((c) => prefixLines(c, "- "))}>
              <List className="h-4 w-4" />
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Numbered steps" onClick={() => apply((c) => prefixLines(c, (n) => `${n + 1}. `))}>
              <ListOrdered className="h-4 w-4" />
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Callout" onClick={() => apply((c) => prefixLines(c, "> "))}>
              <Quote className="h-4 w-4" />
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Table" onClick={() => apply((c) => insertBlock(c, TABLE_TEMPLATE))}>
              <Table className="h-4 w-4" />
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Divider" onClick={() => apply((c) => insertBlock(c, "---"))}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <button type="button" className={TOOLBAR_BUTTON} title="Web link (⌘K)" onClick={() => apply((c) => wrapSelection(c, "[", "](https://)", "link text"))}>
              <Link2 className="h-4 w-4" />
            </button>
            <button type="button" className={cn(TOOLBAR_BUTTON, "w-auto px-2 text-xs font-medium")} title="Link to another article" onClick={() => setLinkOpen(true)}>
              Article link
            </button>
            <button type="button" className={TOOLBAR_BUTTON} title="Image (or paste / drop one)" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              hidden
              onChange={(event) => {
                void uploadImages(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </div>
          <textarea
            ref={textarea}
            aria-label="Article text (markdown)"
            value={draft.markdown}
            spellCheck
            readOnly={saved.archived}
            onChange={(event) => set("markdown", event.target.value)}
            onKeyDown={onEditorKey}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files);
              if (files.some((file) => file.type.startsWith("image/"))) {
                event.preventDefault();
                void uploadImages(files);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const files = Array.from(event.dataTransfer.files);
              if (files.length) {
                event.preventDefault();
                void uploadImages(files);
              }
            }}
            placeholder={"Write in markdown.\n\n# A section\n\nSteps:\n1. Open the Card tab\n2. Tap **Add to Apple Wallet**"}
            className="min-h-[60vh] w-full flex-1 resize-none rounded-b-lg p-4 font-mono text-[13px] leading-6 text-gray-800 outline-none"
          />
        </section>

        <section className={cn("rounded-lg bg-white p-6 shadow-sm", mode === "write" && "hidden xl:block")}>
          <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
            <span>Preview, as on the site</span>
            {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <h1 className="mb-2 text-[28px] font-bold leading-tight tracking-tight text-gray-900">{draft.title || "Untitled"}</h1>
          {draft.description.trim() && <p className="mb-5 text-[17px] text-gray-500">{draft.description}</p>}
          {draft.markdown.trim() ? (
            <article className="help-prose" dangerouslySetInnerHTML={{ __html: preview?.html ?? "" }} />
          ) : (
            <p className="text-sm text-gray-400">Nothing written yet.</p>
          )}
        </section>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Details</h2>
            <div>
              <Label htmlFor="slug">Address</Label>
              <div className="mt-1 flex items-center rounded-md border border-gray-300 bg-white text-sm focus-within:ring-2 focus-within:ring-indigo-200">
                <span className="pl-2 text-gray-400">/articles/</span>
                <input
                  id="slug"
                  value={draft.slug}
                  onChange={(event) => set("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="h-9 min-w-0 flex-1 bg-transparent pr-2 outline-none"
                />
              </div>
              {slugChanged && saved.versionCount > 0 && (
                <p className="mt-1 text-xs text-gray-500">The old address will keep redirecting here.</p>
              )}
              {saved.publicUrl && !slugChanged && (
                <a href={saved.publicUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline">
                  View on the site <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div>
              <Label htmlFor="description">Summary</Label>
              <Textarea
                id="description"
                rows={3}
                maxLength={300}
                value={draft.description}
                placeholder="One or two sentences, shown under the title and in search results"
                onChange={(event) => set("description", event.target.value)}
              />
              <p className="mt-1 text-right text-xs text-gray-400">{draft.description.length}/300</p>
            </div>
            <div>
              <Label htmlFor="collection">Collection</Label>
              <select
                id="collection"
                className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                value={draft.collectionId}
                onChange={(event) => set("collectionId", event.target.value)}
              >
                <option value="">No collection</option>
                {ordered.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.depth ? "— " : ""}
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="audience">Who can read it</Label>
              <select
                id="audience"
                className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                value={draft.audience}
                onChange={(event) => set("audience", event.target.value as HelpAudience)}
              >
                {HELP_AUDIENCES.map((value) => (
                  <option key={value} value={value}>
                    {HELP_AUDIENCE_LABELS[value]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {draft.audience === "public"
                  ? "On the site, in the app and in Solid AI's answers."
                  : draft.audience === "signed_in"
                    ? "In the app and in Solid AI's answers; not on the public site."
                    : "Only here in the portal. Never shown to customers or Solid AI."}
              </p>
            </div>
            <div>
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                type="email"
                value={draft.ownerEmail}
                placeholder="who keeps it correct"
                onChange={(event) => set("ownerEmail", event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <div>
                <div className="text-gray-500">Last verified</div>
                <div className={cn("text-gray-900", saved.stale && "text-red-700")}>
                  {shortDate(saved.verifiedAt)}
                  {saved.verifiedBy && <span className="text-gray-500"> · {personName(saved.verifiedBy)}</span>}
                </div>
              </div>
              {!saved.archived && (
                <Button size="sm" variant="outline" onClick={() => runAction("verify", "Marked as verified")} disabled={action.isPending}>
                  Verify
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Did it help? (live version)</span>
              <FeedbackScore {...saved.liveFeedback} />
            </div>
            {saved.intercomArticleId && (
              <p className="text-xs text-gray-400">Imported from Intercom article {saved.intercomArticleId}.</p>
            )}
          </section>
          <VersionsPanel
            articleId={saved.id}
            restoring={restore.isPending}
            onRestore={(number) =>
              restore.mutate(number, {
                onSuccess: (article) => {
                  setSaved(article);
                  setDraft(toDraft(article));
                  toast.success(`Version ${number} is in the editor. Publish to make it live.`);
                },
              })
            }
          />
        </aside>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{published ? "Publish changes" : "Publish article"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {draft.audience === "public"
              ? "It goes live on the help site, in the app and in Solid AI's answers within a minute."
              : draft.audience === "signed_in"
                ? "It goes live in the app and in Solid AI's answers within a minute."
                : "Internal articles stay in the portal."}{" "}
            Each publish is kept as a version.
          </p>
          <div>
            <Label htmlFor="note">What changed (optional)</Label>
            <Input id="note" maxLength={300} value={note} placeholder="Updated the FX fee for Prime" onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={publishing || !draft.title.trim() || !draft.markdown.trim()}>
              {publishing && <Loader2 className="animate-spin" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={confirm !== null}
        title={confirm === "archive" ? "Archive this article?" : "Unpublish this article?"}
        message={
          confirm === "archive"
            ? "It comes off the site, the app and Solid AI, and leaves the lists. Its address stays reserved, and you can restore it later."
            : "It comes off the site, the app and Solid AI right away. Its versions are kept; publish again to bring it back."
        }
        confirmText={confirm === "archive" ? "Archive" : "Unpublish"}
        isDestructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) runAction(confirm, confirm === "archive" ? "Archived" : "Unpublished");
          setConfirm(null);
        }}
      />

      <ArticleLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        excludeId={saved.id}
        onPick={(article) => apply((current) => wrapSelection(current, "[", `](/articles/${article.slug})`, article.title))}
      />
    </div>
  );
}

function EditorLoader({ id }: { id: string }) {
  const { data, isLoading, isError } = useHelpArticle(id);
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Article not found</h1>
        <Link href="/support/articles" className="mt-2 inline-block text-sm text-indigo-700 hover:underline">
          Back to the Help Center
        </Link>
      </div>
    );
  }
  return <Editor key={data.id} initial={data} />;
}

export default function HelpArticleEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <SupportMeGate>{() => <EditorLoader id={id} />}</SupportMeGate>;
}
