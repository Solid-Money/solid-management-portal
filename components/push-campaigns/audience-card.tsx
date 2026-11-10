"use client";

import { useRef } from "react";
import { FileUp, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedAudience } from "@/lib/push-campaigns";
import { formatNumber } from "@/lib/utils";
import type { PushCampaignPreview } from "@/types/push-campaigns";

/** A user list is ids and a few columns; anything bigger is the wrong file. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const count = (n: number) => formatNumber(n, 0, 0);

interface AudienceCardProps {
  raw: string;
  onRawChange: (raw: string) => void;
  parsed: ParsedAudience;
  maxRecipients: number;
  preview: PushCampaignPreview | null;
  /** The list changed since `preview` was taken. */
  previewStale: boolean;
  isPreviewing: boolean;
  disabled: boolean;
  onPreview: () => void;
}

/** Who the campaign is for: a pasted or uploaded list, and who of it is reachable. */
export function AudienceCard({
  raw,
  onRawChange,
  parsed,
  maxRecipients,
  preview,
  previewStale,
  isPreviewing,
  disabled,
  onPreview,
}: AudienceCardProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const overLimit = parsed.ids.length > maxRecipients;

  const readFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("That file is over 5 MB. Export only the user id column.");
      return;
    }
    onRawChange(await file.text());
  };

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Audience
          </CardTitle>
          <CardDescription>
            User ids, pasted or from a CSV — an Amplitude cohort export works
            as it is: its <span className="font-mono">user_id</span> column is
            read and the rest ignored. Up to {count(maxRecipients)} users.
          </CardDescription>
        </div>
        <CardAction>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={disabled}
          >
            <FileUp />
            Upload CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="push-audience" className="sr-only">
            User ids
          </Label>
          <Textarea
            id="push-audience"
            value={raw}
            onChange={(e) => onRawChange(e.target.value)}
            placeholder={"688b65a758350ee917f73832\n68b80a7b287d8e0a27034010"}
            className="h-36 font-mono text-xs"
            disabled={disabled}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>
              {count(parsed.ids.length)} user id(s)
              {parsed.source === "column" && parsed.column
                ? ` from the “${parsed.column}” column`
                : ""}
            </span>
            {parsed.duplicates > 0 ? (
              <Badge variant="muted">{count(parsed.duplicates)} repeated</Badge>
            ) : null}
            {parsed.invalid.length > 0 ? (
              <Badge
                variant="warning"
                title={parsed.invalid.slice(0, 20).join(", ")}
              >
                {count(parsed.invalid.length)} not a user id (ignored)
              </Badge>
            ) : null}
            {overLimit ? (
              <Badge variant="danger">
                over the {count(maxRecipients)} limit
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={onPreview}
            disabled={
              disabled || isPreviewing || parsed.ids.length === 0 || overLimit
            }
          >
            {isPreviewing ? <Loader2 className="animate-spin" /> : null}
            Check audience
          </Button>
          <span className="text-xs text-gray-500">
            Finds who has an open account and a device for push. Sends nothing.
          </span>
        </div>

        {preview ? (
          <div className="rounded-lg border bg-gray-50 p-3">
            {previewStale ? (
              <p className="mb-2 text-xs text-amber-700">
                The list changed since this check. Check it again before
                sending.
              </p>
            ) : null}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Can receive a push" value={preview.reachable} strong />
              <Stat label="No push device" value={preview.unreachable} />
              <Stat label="No open account" value={preview.notFoundCount} />
              <Stat label="Ids checked" value={preview.requested} />
            </dl>
            {preview.notFound.length > 0 ? (
              <p
                className="mt-2 truncate font-mono text-[11px] text-gray-400"
                title={preview.notFound.join(", ")}
              >
                Not found: {preview.notFound.slice(0, 5).join(", ")}
                {preview.notFoundCount > 5 ? "…" : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd
        className={
          strong
            ? "text-lg font-semibold text-gray-900 tabular-nums"
            : "text-lg text-gray-700 tabular-nums"
        }
      >
        {count(value)}
      </dd>
    </div>
  );
}
