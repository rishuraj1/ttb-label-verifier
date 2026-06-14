"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import {
  FIELD_LABELS,
  type BatchItemResult,
  type BatchVerifyResponse,
  type OverrideMap,
} from "@/lib/verify/types";
import { Button } from "@/components/ui/button";
import { ExportJsonButton } from "@/components/verify/export-json-button";
import { VerificationResults } from "@/components/verify/verification-results";
import { OverallResultBadge } from "@/components/verify/status-badge";
import { cn } from "@/lib/utils";

function exportBatchCsv(
  response: BatchVerifyResponse,
  overridesPerFile: Record<string, OverrideMap>
) {
  const headers = [
    "filename",
    "field",
    "expected",
    "on_label",
    "ai_status",
    "ai_confidence_pct",
    "ai_explanation",
    "override_status",
    "override_reason",
    "override_at",
    "effective_status",
  ];

  const rows: string[][] = [];

  for (const item of response.items) {
    if (item.error) {
      rows.push([item.filename, "ERROR", "", "", "", "", item.error, "", "", "", ""]);
      continue;
    }
    const itemOverrides = overridesPerFile[item.filename] ?? {};
    for (const result of item.results) {
      const override = itemOverrides[result.field];
      rows.push([
        item.filename,
        FIELD_LABELS[result.field],
        result.expected,
        result.extracted ?? "",
        result.status,
        String(Math.round(result.confidence * 100)),
        result.explanation,
        override?.status ?? "",
        override?.reason ?? "",
        override?.overriddenAt ?? "",
        override?.status ?? result.status,
      ]);
    }
  }

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ttb-batch-verification.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function SmartSummaryCard({ response }: { response: BatchVerifyResponse }) {
  const { summary } = response;
  const hasFailures = summary.failCount > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-sm">Batch summary</p>
          <p className="mt-1 font-semibold text-xl">
            {response.completed} of {response.total} labels processed
          </p>
          <p className="mt-2 text-sm">
            <span className="text-emerald-700 dark:text-emerald-400">
              {summary.passCount} passed
            </span>
            {summary.reviewCount > 0 ? (
              <>
                {" · "}
                <span className="text-amber-700 dark:text-amber-400">
                  {summary.reviewCount} review
                </span>
              </>
            ) : null}
            {summary.failCount > 0 ? (
              <>
                {" · "}
                <span className="text-destructive">{summary.failCount} failed</span>
              </>
            ) : null}
            {summary.errorCount > 0 ? (
              <>
                {" · "}
                <span className="text-muted-foreground">
                  {summary.errorCount} error
                </span>
              </>
            ) : null}
          </p>

          {hasFailures && summary.topFailureReasons.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="font-medium text-destructive text-sm">
                Top failure{summary.topFailureReasons.length > 1 ? "s" : ""}
              </p>
              {summary.topFailureReasons.map((reason) => (
                <div
                  className="rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                  key={reason.field}
                >
                  <p className="font-medium text-sm">
                    {FIELD_LABELS[reason.field]} —{" "}
                    <span className="text-destructive">
                      {reason.count} label{reason.count !== 1 ? "s" : ""}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                    {reason.filenames.slice(0, 5).join(", ")}
                    {reason.filenames.length > 5
                      ? ` +${reason.filenames.length - 5} more`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : !hasFailures ? (
            <p className="mt-3 font-medium text-emerald-700 text-sm dark:text-emerald-400">
              All labels passed verification ✓
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BatchItemCard({
  item,
  overrides,
  onOverridesChange,
}: {
  item: BatchItemResult;
  overrides: OverrideMap;
  onOverridesChange: (overrides: OverrideMap) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{item.filename}</p>
          {item.error ? (
            <p className="mt-1 text-destructive text-sm">{item.error}</p>
          ) : null}
        </div>
        <OverallResultBadge result={item.overall} />
      </button>

      {expanded && !item.error ? (
        <div className="border-t border-border p-4">
          <VerificationResults
            className="space-y-4"
            onOverridesChange={onOverridesChange}
            response={item}
          />
        </div>
      ) : null}
    </div>
  );
}

export function BatchResults({
  response,
  className,
}: {
  response: BatchVerifyResponse;
  className?: string;
}) {
  const [overridesPerFile, setOverridesPerFile] = useState<
    Record<string, OverrideMap>
  >({});

  const handleOverridesChange = (filename: string) => (overrides: OverrideMap) => {
    setOverridesPerFile((prev) => ({ ...prev, [filename]: overrides }));
  };

  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SmartSummaryCard response={response} />
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
          <ExportJsonButton
            data={response}
            filename="ttb-batch-verification.json"
          />
          <Button
            onClick={() => exportBatchCsv(response, overridesPerFile)}
            size="sm"
            type="button"
            variant="outline"
          >
            <DownloadIcon aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {response.items.map((item) => (
          <BatchItemCard
            item={item}
            key={item.filename}
            onOverridesChange={handleOverridesChange(item.filename)}
            overrides={overridesPerFile[item.filename] ?? {}}
          />
        ))}
      </div>
    </section>
  );
}
