"use client";

import { CopyIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import {
  FIELD_LABELS,
  type VerifyResponse,
  type VerificationResult,
} from "@/lib/verify/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExportJsonButton } from "@/components/verify/export-json-button";
import {
  FieldStatusBadge,
  OverallResultBadge,
} from "@/components/verify/status-badge";
import { cn } from "@/lib/utils";

function ConfidenceBar({ confidence, status }: { confidence: number; status: VerificationResult["status"] }) {
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

function ResultRow({ result }: { result: VerificationResult }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{FIELD_LABELS[result.field]}</h3>
        <FieldStatusBadge status={result.status} />
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
      </dl>

      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
        {result.explanation}
      </p>

      <ConfidenceBar confidence={result.confidence} status={result.status} />
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
}: {
  response: VerifyResponse | null;
  streamedFields?: VerificationResult[];
  isStreaming?: boolean;
  processingTimeMs?: number;
  className?: string;
}) {
  const fields = response?.results ?? streamedFields;
  const showPlaceholder = isStreaming && fields.length === 0;

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
              data={response}
              filename="ttb-label-verification.json"
            />
          ) : null}
          {response ? (
            <OverallResultBadge result={response.overall} />
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
            <ResultRow key={result.field} result={result} />
          ))}
        </div>
      ) : null}

      {response?.rejectionDraft ? (
        <RejectionDraft text={response.rejectionDraft} />
      ) : null}
    </section>
  );
}
