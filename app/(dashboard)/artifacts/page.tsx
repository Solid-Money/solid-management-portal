"use client";

import { useState, useSyncExternalStore } from "react";
import {
  ExternalLink,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import {
  artifactsStore,
  isValidArtifactUrl,
  type EmbeddedArtifact,
} from "@/lib/artifacts";

/** One embedded artifact: a header row and the iframe itself. */
function ArtifactFrame({
  artifact,
  onRemove,
}: {
  artifact: EmbeddedArtifact;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{artifact.title}</CardTitle>
          <CardDescription>
            Added {new Date(artifact.addedAt).toLocaleDateString()}
          </CardDescription>
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="cursor-pointer"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in a new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            className="cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label="Remove artifact"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          src={artifact.url}
          title={artifact.title}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          referrerPolicy="no-referrer"
          className={`w-full rounded-b-xl border-0 bg-white transition-[height] ${
            expanded ? "h-[80vh]" : "h-[28rem]"
          }`}
        />
      </CardContent>
    </Card>
  );
}

export default function ArtifactsPage() {
  const artifacts = useSyncExternalStore(
    artifactsStore.subscribe,
    artifactsStore.getSnapshot,
    artifactsStore.getServerSnapshot
  );
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<EmbeddedArtifact | null>(
    null
  );

  const addArtifact = (event: React.FormEvent) => {
    event.preventDefault();

    if (!isValidArtifactUrl(url)) {
      toast.error(
        "That doesn't look like a Claude artifact link — it should start with https://claude.ai/ or https://claude.site/"
      );
      return;
    }
    if (artifactsStore.has(url)) {
      toast.error("That artifact is already embedded below.");
      return;
    }

    const added = artifactsStore.add(title.trim() || "Untitled artifact", url);
    setTitle("");
    setUrl("");
    toast.success(`Added "${added.title}"`);
  };

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    artifactsStore.remove(pendingRemoval.id);
    toast.success(`Removed "${pendingRemoval.title}"`);
    setPendingRemoval(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <LayoutTemplate className="h-6 w-6 text-indigo-600" />
          Claude Artifacts
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Embed dashboards, reports and tools published from Claude so the team
          can see them here instead of hunting for links. The list is saved in
          this browser.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add an artifact</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={addArtifact}
            className="flex flex-col gap-3 md:flex-row md:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="artifact-title">Title</Label>
              <Input
                id="artifact-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Treasury & Runway — Team Review"
              />
            </div>
            <div className="flex-[2] space-y-1.5">
              <Label htmlFor="artifact-url">Artifact link</Label>
              <Input
                id="artifact-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://claude.ai/…"
                required
              />
            </div>
            <Button type="submit" className="cursor-pointer">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
          <p className="mt-2 text-xs text-gray-500">
            Paste the artifact&apos;s share link from Claude. If an embed stays
            blank, the artifact&apos;s sharing settings don&apos;t allow
            embedding — open it in a new tab instead.
          </p>
        </CardContent>
      </Card>

      {artifacts.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            No artifacts yet. Paste a Claude artifact link above to embed it
            here.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {artifacts.map((artifact) => (
          <ArtifactFrame
            key={artifact.id}
            artifact={artifact}
            onRemove={() => setPendingRemoval(artifact)}
          />
        ))}
      </div>

      <ConfirmationModal
        isOpen={pendingRemoval !== null}
        title="Remove artifact"
        message={
          pendingRemoval
            ? `Remove "${pendingRemoval.title}" from the dashboard? The artifact itself is not affected.`
            : ""
        }
        confirmText="Remove"
        isDestructive
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
