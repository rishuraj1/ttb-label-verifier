"use client";

import { CopyIcon, CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  FIELD_LABELS,
  type FieldOverride,
  type FieldStatus,
  type OverrideMap,
  type VerifiableFieldKey,
  type VerificationResult,
  type VerifyResponse,
} from "@/lib/verify/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExportJsonButton } from "@/components/verify/export-json-button";
import {
  FieldStatusBadge,
  OverallResultBadge,
} from "@/components/verify/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OverallResult } from "@/lib/verify/types";

function computeEffectiveOverall(
  results: VerificationResult[],
  overrides: OverrideMap
): OverallResult {
  const statuses = results.map((r) => overrides[r.field]?.status ?? r.status);
  if (statuses.some((s) => s === "fail")) return "FAIL";
  if (statuses.some((s) => s === "review" || s === "absent" || s === "warn"))
    return "REVIEW";
  return "PASS";
}

function ConfidenceBar({
  confidence,
  status,
}: {
  confidence: number;
  status: FieldStatus;
}) {
  const barColor =
    status === "pass"
      ? "bg-emerald-500"
      : status === "fail"
        ? "bg-destructive"
        : status === "warn"
          ? "bg-amber-500"
          : status === "review"
            ? "bg-blue-500"
            : "bg-muted-foreground";

  return (
    <div
      aria-hidden="true"
      className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn("h-full rounded-full transition-all", barColor)}
        style={{ width: `${Math.round(confidence * 100)}%` }}
      />
    </div>
  );
}

function OverrideForm({
  field,
  currentOverride,
  onApply,
  onClear,
  onCancel,
}: {
  field: VerifiableFieldKey;
  currentOverride: FieldOverride | undefined;
  onApply: (override: FieldOverride) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<FieldStatus>(
    currentOverride?.status ?? "pass"
  );
  const [reason, setReason] = useState(currentOverride?.reason ?? "");

  const handleApply = () => {
    if (!reason.trim()) return;
    onApply({ status, reason: reason.trim(), overriddenAt: new Date().toISOString() });
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-amber-400/40 bg-amber-50/50 p-3 dark:bg-amber-950/20">
      <p className="font-medium text-amber-800 text-xs dark:text-amber-300">
        Agent override — {FIELD_LABELS[field]}
      </p>
      <div className="flex items-center gap-2">
        <label className="w-16 shrink-0 text-muted-foreground text-xs">
          New status
        </label>
        <Select
          onValueChange={(v) => setStatus(v as FieldStatus)}
          value={status}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pass">Pass</SelectItem>
            <SelectItem value="fail">Fail</SelectItem>
            <SelectItem value="review">Review</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-muted-foreground text-xs">
          Reason <span className="text-destructive">*</span>
        </label>
        <Textarea
          className="min-h-16 resize-none text-xs"
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you are overriding this verdict…"
          value={reason}
        />
      </div>
      <div className="flex gap-2">
        <Button
          className="h-7 text-xs"
          disabled={!reason.trim()}
          onClick={handleApply}
          size="sm"
          type="button"
        >
          Apply override
        </Button>
        {currentOverride ? (
          <Button
            className="h-7 text-xs"
            onClick={onClear}
            size="sm"
            type="button"
            variant="outline"
          >
            Clear override
          </Button>
        ) : null}
        <Button
          className="h-7 text-xs"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ResultRow({
  result,
  override,
  onOverride,
}: {
  result: VerificationResult;
  override: FieldOverride | undefined;
  onOverride: (field: VerifiableFieldKey, override: FieldOverride | null) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const effectiveStatus = override?.status ?? result.status;
  const isOverridden = !!override;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isOverridden ? "border-amber-400/60" : "border-border"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{FIELD_LABELS[result.field]}</h3>
          {isOverridden ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 text-xs dark:bg-amber-900/40 dark:text-amber-300">
              Agent override
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isOverridden ? (
            <span className="text-muted-foreground text-xs line-through">
              {result.status}
            </span>
          ) : null}
          <FieldStatusBadge status={effectiveStatus} />
        </div>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
          <dt className="text-muted-foreground">Expected</dt>
          <dd className="break-words">{result.expected}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
          <dt className="text-muted-foreground">On label</dt>
          <dd className="break-words font-mono text-sm">
            {result.extracted ?? (
              <span className="font-sans text-muted-foreground italic">
                Not detected
              </span>
            )}
          </dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
          <dt className="text-muted-foreground">Confidence</dt>
          <dd>{Math.round(result.confidence * 100)}%</dd>
        </div>
        {isOverridden ? (
          <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
            <dt className="text-muted-foreground">Override reason</dt>
            <dd className="break-words text-amber-800 dark:text-amber-300">
              {override.reason}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
        {result.explanation}
      </p>

      <ConfidenceBar confidence={result.confidence} status={effectiveStatus} />

      <div className="mt-3 flex justify-end">
        {showForm ? (
          <button
            aria-label="Cancel override"
            className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => setShowForm(false)}
            type="button"
          >
            <XIcon className="size-3" />
            Cancel
          </button>
        ) : (
          <button
            aria-label={isOverridden ? "Edit override" : "Override verdict"}
            className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => setShowForm(true)}
            type="button"
          >
            <PencilIcon className="size-3" />
            {isOverridden ? "Edit override" : "Override"}
          </button>
        )}
      </div>

      {showForm ? (
        <OverrideForm
          currentOverride={override}
          field={result.field}
          onApply={(ov) => {
            onOverride(result.field, ov);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
          onClear={() => {
            onOverride(result.field, null);
            setShowForm(false);
          }}
        />
      ) : null}
    </div>
  );
}

function RejectionDraft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium text-destructive">TTB Rejection Draft</h3>
        <Button
          aria-label={copied ? "Copied" : "Copy rejection draft"}
          onClick={handleCopy}
          size="sm"
          type="button"
          variant="outline"
        >
          {copied ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Textarea
        className="min-h-48 bg-background/80 font-mono text-sm leading-relaxed"
        readOnly
        value={text}
      />
    </div>
  );
}

export function VerificationResults({
  response,
  streamedFields = [],
  isStreaming = false,
  processingTimeMs,
  className,
  onOverridesChange,
}: {
  response: VerifyResponse | null;
  streamedFields?: VerificationResult[];
  isStreaming?: boolean;
  processingTimeMs?: number;
  className?: string;
  onOverridesChange?: (overrides: OverrideMap) => void;
}) {
  const [overrides, setOverrides] = useState<OverrideMap>({});

  const handleOverride = (
    field: VerifiableFieldKey,
    override: FieldOverride | null
  ) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (override === null) {
        delete next[field];
      } else {
        next[field] = override;
      }
      onOverridesChange?.(next);
      return next;
    });
  };

  const fields = response?.results ?? streamedFields;
  const showPlaceholder = isStreaming && fields.length === 0;

  const effectiveOverall =
    response && fields.length > 0
      ? computeEffectiveOverall(fields, overrides)
      : response?.overall ?? null;

  const showRejection =
    effectiveOverall === "FAIL" && !!response?.rejectionDraft;

  const exportData =
    response && Object.keys(overrides).length > 0
      ? { ...response, overall: effectiveOverall, _agentOverrides: overrides }
      : response;

  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div>
          <p className="text-muted-foreground text-sm">Verification results</p>
          <p className="mt-1 font-semibold text-xl">Label verification</p>
          {processingTimeMs ? (
            <p className="mt-1 text-muted-foreground text-xs">
              Processed in {(processingTimeMs / 1000).toFixed(1)}s
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {response ? (
            <ExportJsonButton
              data={exportData}
              filename="ttb-label-verification.json"
            />
          ) : null}
          {effectiveOverall ? (
            <OverallResultBadge result={effectiveOverall} />
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 font-medium text-muted-foreground text-sm">
              <span className="size-2 animate-pulse rounded-full bg-amber-500" />
              Verifying…
            </span>
          ) : null}
        </div>
      </div>

      {showPlaceholder ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
          Analyzing label — field results will appear here as they complete.
        </div>
      ) : null}

      {fields.length > 0 ? (
        <div className="grid gap-4">
          {fields.map((result) => (
            <ResultRow
              key={result.field}
              onOverride={handleOverride}
              override={overrides[result.field]}
              result={result}
            />
          ))}
        </div>
      ) : null}

      {showRejection ? (
        <RejectionDraft text={response!.rejectionDraft!} />
      ) : null}
    </section>
  );
}
