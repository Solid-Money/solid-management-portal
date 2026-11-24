"use client";

import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNudgeTemplate } from "@/hooks/use-nudges";
import { missingTemplateParams, type NudgeEmailDraft } from "@/lib/nudges";
import type { NudgeVariable } from "@/types/nudges";

interface EmailFieldsProps {
  value: NudgeEmailDraft;
  onChange: (next: NudgeEmailDraft) => void;
  variables: NudgeVariable[];
  disabled: boolean;
  hideEnabled?: boolean;
}

/**
 * The email half of a nudge. The email itself is written in Brevo; here it is
 * picked by template id, checked live against Brevo (name, subject, active,
 * which params it reads) and previewed.
 */
export function EmailFields({
  value,
  onChange,
  variables,
  disabled,
  hideEnabled = false,
}: EmailFieldsProps) {
  const id = useId();
  const [checkedId, setCheckedId] = useState<number | null>(value.templateId);
  const [showHtml, setShowHtml] = useState(false);
  const template = useNudgeTemplate(checkedId);

  const set = (patch: Partial<NudgeEmailDraft>) => onChange({ ...value, ...patch });
  const fieldsDisabled = disabled || (!hideEnabled && !value.enabled);
  const missing = template.data
    ? missingTemplateParams(template.data.params, variables)
    : [];
  const checkedIsCurrent =
    checkedId !== null && checkedId === value.templateId;

  return (
    <div className="space-y-4">
      {!hideEnabled ? (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-enabled`}>Send the email</Label>
          <Switch
            id={`${id}-enabled`}
            checked={value.enabled}
            onCheckedChange={(enabled) => set({ enabled })}
            disabled={disabled}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-template`}>Brevo template id</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-template`}
            inputMode="numeric"
            value={value.templateId ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              set({ templateId: digits ? Number(digits) : null });
            }}
            placeholder="e.g. 427"
            disabled={fieldsDisabled}
            className="max-w-40"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowHtml(false);
              setCheckedId(value.templateId);
              if (value.templateId === checkedId) void template.refetch();
            }}
            disabled={!value.templateId || template.isFetching}
          >
            {template.isFetching ? <Loader2 className="animate-spin" /> : <Search />}
            Check template
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Write and design the email in Brevo; the template&apos;s{" "}
          <code>{"{{ params.x }}"}</code> placeholders are filled from this
          nudge&apos;s variables.
        </p>
      </div>

      {checkedId && template.isError ? (
        <p className="flex items-center gap-1.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Brevo has no template {checkedId}, or it could not be read.
        </p>
      ) : null}

      {template.data && checkedId ? (
        <div className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
          {!checkedIsCurrent ? (
            <p className="text-xs text-amber-700">
              Showing template {checkedId}; the id above has changed since. Check
              again.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{template.data.name}</span>
            {template.data.isActive ? (
              <Badge variant="success">
                <CheckCircle2 />
                active
              </Badge>
            ) : (
              <Badge variant="warning">inactive in Brevo</Badge>
            )}
            {template.data.tag ? (
              <Badge variant="muted">{template.data.tag}</Badge>
            ) : null}
          </div>
          <p className="text-gray-600">
            <span className="text-gray-400">Subject:</span> {template.data.subject}
          </p>
          <p className="text-gray-600">
            <span className="text-gray-400">Params:</span>{" "}
            {template.data.params.length > 0
              ? template.data.params.join(", ")
              : "none"}
          </p>
          {missing.length > 0 ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              The template reads {missing.map((p) => `params.${p}`).join(", ")}
              , which this nudge does not send: Brevo will render{" "}
              {missing.length === 1 ? "it" : "them"} empty.
            </p>
          ) : null}
          {!template.data.isActive ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Brevo does not send inactive templates. Send a test, then activate
              it in Brevo.
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHtml((shown) => !shown)}
          >
            <Eye />
            {showHtml ? "Hide the email" : "Show the email"}
          </Button>
          {showHtml ? (
            <iframe
              title={`Brevo template ${template.data.id}`}
              sandbox=""
              srcDoc={template.data.htmlContent}
              className="h-[480px] w-full rounded-md border border-gray-200 bg-white"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
