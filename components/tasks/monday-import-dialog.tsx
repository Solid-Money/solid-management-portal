"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TASK_KEYS, useTaskImport } from "@/hooks/use-tasks";
import { startMondayImport } from "@/lib/tasks-api";

const BOARDS = [
  { id: "9660642586", name: "Main Sprint" },
  { id: "8932945708", name: "Solid Operations" },
];

/**
 * One-time move from monday: every item, its updates, replies and images.
 * The admin pastes a monday personal API token; it is used for this import
 * and never stored. Running it again skips what is already here.
 */
export default function MondayImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [boards, setBoards] = useState<string[]>(BOARDS.map((b) => b.id));
  const [starting, setStarting] = useState(false);
  const { data: job } = useTaskImport(open);
  const running = job?.status === "running";

  const start = async () => {
    setStarting(true);
    try {
      const started = await startMondayImport(token.trim(), boards);
      queryClient.setQueryData(TASK_KEYS.import, started);
      setToken("");
    } catch {
      // The API layer shows the error.
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from monday</DialogTitle>
          <DialogDescription>
            Brings every item with its updates, replies and images. Owners are matched to admins by
            name. Nobody is notified. Running it again skips what is already here.
          </DialogDescription>
        </DialogHeader>

        {job && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2 font-medium text-gray-900">
              {job.status === "running" ? (
                <Loader2 className="size-4 animate-spin text-indigo-600" />
              ) : job.status === "done" ? (
                <CheckCircle2 className="size-4 text-green-600" />
              ) : (
                <TriangleAlert className="size-4 text-red-600" />
              )}
              {job.status === "running" ? "Importing…" : job.status === "done" ? "Import finished" : "Import stopped"}
            </div>
            <p className="mt-1 text-gray-600">
              {job.items} items found · {job.created} imported · {job.skipped} already here · {job.updates} updates ·{" "}
              {job.images} images
            </p>
            {job.error && <p className="mt-1 text-red-700">{job.error}</p>}
            {job.failed.length > 0 && (
              <p className="mt-1 text-amber-700">{job.failed.length} items could not be imported.</p>
            )}
            {job.unmatchedPeople.length > 0 && (
              <p className="mt-1 text-gray-500">
                No admin matched: {job.unmatchedPeople.slice(0, 8).join(", ")}
                {job.unmatchedPeople.length > 8 ? "…" : ""}. Their items came in without an owner.
              </p>
            )}
          </div>
        )}

        {!running && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="monday-token" className="text-sm font-medium text-gray-900">
                monday API token
              </label>
              <Input
                id="monday-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste your personal API token"
              />
              <a
                href="https://fuse-org.monday.com/apps/manage/tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline"
              >
                Get it in monday: Profile → Developers → My access tokens <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-gray-900">Boards</span>
              {BOARDS.map((board) => (
                <label key={board.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <Checkbox
                    checked={boards.includes(board.id)}
                    onCheckedChange={(checked) =>
                      setBoards((current) =>
                        checked === true ? [...current, board.id] : current.filter((id) => id !== board.id),
                      )
                    }
                  />
                  {board.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {running ? "Close (it keeps going)" : "Close"}
          </Button>
          {!running && (
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={token.trim().length < 20 || !boards.length || starting}
              onClick={() => void start()}
            >
              {starting && <Loader2 className="animate-spin" />}
              {job?.status === "done" ? "Import again" : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
