"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PushPreview } from "@/components/nudges/push-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  destinationForPath,
  insertAt,
  isValidAppPath,
  pushCopyIssues,
  renderExample,
  type NudgePushDraft,
} from "@/lib/nudges";
import { uploadImageFile } from "@/lib/upload";
import { UPLOAD_IMAGE_MAX_BYTES, UPLOAD_IMAGE_TYPES } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import type {
  NudgeCatalogView,
  NudgeDestinationView,
  NudgeVariable,
} from "@/types/nudges";

const CUSTOM = "__custom__";

interface PushFieldsProps {
  value: NudgePushDraft;
  /**
   * Called with an updater, not a value: an upload finishes after the admin
   * may have typed more, and must merge into the draft as it is by then.
   */
  onChange: (update: (current: NudgePushDraft) => NudgePushDraft) => void;
  variables: NudgeVariable[];
  catalog: NudgeCatalogView;
  disabled: boolean;
  /** Hide the on/off switch (a new nudge's push is on when it exists). */
  hideEnabled?: boolean;
  /** Used for the uploaded image's file name. */
  nudgeKey: string;
}

/**
 * The push half of a nudge: copy with clickable variables, where the tap
 * goes, the image, and a preview with example values.
 */
export function PushFields({
  value,
  onChange,
  variables,
  catalog,
  disabled,
  hideEnabled = false,
  nudgeKey,
}: PushFieldsProps) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastField = useRef<"title" | "body">("body");
  const [uploading, setUploading] = useState(false);
  const { limits, destinations, copyRules } = catalog;

  const matched = useMemo(
    () => destinationForPath(value.path, destinations),
    [value.path, destinations]
  );
  const [customPath, setCustomPath] = useState(!matched);
  const selectValue = customPath ? CUSTOM : (matched?.id ?? CUSTOM);

  const issues = pushCopyIssues(
    { title: value.title, body: value.body },
    variables,
    limits,
    copyRules
  );
  const pathInvalid = value.path.trim() !== "" && !isValidAppPath(value.path);

  const set = (patch: Partial<NudgePushDraft>) =>
    onChange((current) => ({ ...current, ...patch }));

  const insertVariable = (name: string) => {
    const token = `{${name}}`;
    if (lastField.current === "title") {
      const el = titleRef.current;
      const { text, caret } = insertAt(
        value.title,
        token,
        el?.selectionStart ?? value.title.length,
        el?.selectionEnd ?? value.title.length
      );
      set({ title: text });
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(caret, caret);
      });
    } else {
      const el = bodyRef.current;
      const { text, caret } = insertAt(
        value.body,
        token,
        el?.selectionStart ?? value.body.length,
        el?.selectionEnd ?? value.body.length
      );
      set({ body: text });
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(caret, caret);
      });
    }
  };

  const chooseDestination = (next: string) => {
    if (next === CUSTOM) {
      setCustomPath(true);
      set({ destinationId: null });
      return;
    }
    const destination = destinations.find((d) => d.id === next);
    if (!destination) return;
    setCustomPath(false);
    set({ path: destination.path, destinationId: destination.id });
  };

  const upload = async (file: File) => {
    if (!UPLOAD_IMAGE_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPEG, WebP, GIF or AVIF image.");
      return;
    }
    if (file.size > UPLOAD_IMAGE_MAX_BYTES) {
      toast.error("Images must be 4 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const url = await uploadImageFile(file, `nudges/${nudgeKey}.${extension}`);
      set({ imageUrl: url });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't upload the image."
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const groups = useMemo(() => {
    const byGroup = new Map<string, NudgeDestinationView[]>();
    for (const destination of destinations) {
      const list = byGroup.get(destination.group) ?? [];
      list.push(destination);
      byGroup.set(destination.group, list);
    }
    return [...byGroup.entries()];
  }, [destinations]);

  const fieldsDisabled = disabled || (!hideEnabled && !value.enabled);

  return (
    <div className="space-y-4">
      {!hideEnabled ? (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-enabled`}>Send the push</Label>
          <Switch
            id={`${id}-enabled`}
            checked={value.enabled}
            onCheckedChange={(enabled) => set({ enabled })}
            disabled={disabled}
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${id}-title`}>Title</Label>
              <Counter length={value.title.length} max={limits.pushTitleMax} />
            </div>
            <Input
              id={`${id}-title`}
              ref={titleRef}
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
              onFocus={() => (lastField.current = "title")}
              disabled={fieldsDisabled}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${id}-body`}>Body</Label>
              <Counter
                length={value.body.length}
                max={limits.pushBodyMax}
                soft={limits.pushBodyCollapsed}
              />
            </div>
            <Textarea
              id={`${id}-body`}
              ref={bodyRef}
              value={value.body}
              onChange={(e) => set({ body: e.target.value })}
              onFocus={() => (lastField.current = "body")}
              rows={3}
              disabled={fieldsDisabled}
            />
          </div>

          {variables.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">
                Insert a variable where the cursor is:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    title={`${variable.description} (e.g. ${variable.example})`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVariable(variable.name)}
                    disabled={fieldsDisabled}
                    className="cursor-pointer rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-xs text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {`{${variable.name}}`}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              This nudge has no variables: its copy is fixed text.
            </p>
          )}

          {issues.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {issues.map((issue) => (
                <li
                  key={issue.message}
                  className={cn(
                    "flex items-start gap-1.5",
                    issue.level === "error" ? "text-red-700" : "text-amber-700"
                  )}
                >
                  {issue.level === "error" ? (
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  )}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <PushPreview
          title={renderExample(value.title, variables)}
          body={renderExample(value.body, variables)}
          imageUrl={value.imageUrl}
          collapsedAt={limits.pushBodyCollapsed}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-destination`}>Opens</Label>
        <Select
          value={selectValue}
          onValueChange={chooseDestination}
          disabled={fieldsDisabled}
        >
          <SelectTrigger id={`${id}-destination`} className="w-full">
            <SelectValue placeholder="Choose a screen" />
          </SelectTrigger>
          <SelectContent>
            {groups.map(([group, list]) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {list.map((destination) => (
                  <SelectItem key={destination.id} value={destination.id}>
                    {destination.label}
                    {destination.needsNewApp ? " (new app builds)" : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            <SelectSeparator />
            <SelectItem value={CUSTOM}>Custom in-app path…</SelectItem>
          </SelectContent>
        </Select>
        {selectValue === CUSTOM ? (
          <>
            <Input
              value={value.path}
              onChange={(e) => {
                const path = e.target.value;
                set({
                  path,
                  destinationId: destinationForPath(path, destinations)?.id ?? null,
                });
              }}
              placeholder="/rewards?referral=open"
              aria-invalid={pathInvalid}
              disabled={fieldsDisabled}
              className="font-mono"
            />
            <p className="text-xs text-gray-500">
              An in-app path with its query. UTM tags are added when the push is
              sent. Screens outside the list above only open on app builds that
              route any path from a push.
            </p>
            {pathInvalid ? (
              <p className="text-xs text-red-700">
                Start with “/” and use only letters, digits and - . _ ~ / ? = &amp;
              </p>
            ) : null}
          </>
        ) : matched ? (
          <p className="text-xs text-gray-500">{matched.description}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-image`}>Image (optional)</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-image`}
            value={value.imageUrl ?? ""}
            onChange={(e) => set({ imageUrl: e.target.value || null })}
            placeholder="https://…"
            disabled={fieldsDisabled}
          />
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_IMAGE_TYPES.filter((t) => t !== "image/svg+xml").join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={fieldsDisabled || uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            Upload
          </Button>
          {value.imageUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => set({ imageUrl: null })}
              disabled={fieldsDisabled}
              aria-label="Remove image"
            >
              <X />
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-gray-500">
          A thumbnail on iOS and the expanded image on Android. The small
          status-bar icon is part of the app and cannot change per push.
        </p>
      </div>
    </div>
  );
}

function Counter({
  length,
  max,
  soft,
}: {
  length: number;
  max: number;
  soft?: number;
}) {
  const over = length > max;
  const past = soft !== undefined && length > soft;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        over ? "text-red-700" : past ? "text-amber-700" : "text-gray-400"
      )}
    >
      {length}/{max}
      {soft !== undefined ? ` · cut at ${soft}` : ""}
    </span>
  );
}
