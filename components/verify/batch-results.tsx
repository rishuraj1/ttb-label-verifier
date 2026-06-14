"use client";

import { useState } from "react";
import {
  type BatchItemResult,
  type BatchVerifyResponse,
} from "@/lib/verify/types";
import { ExportJsonButton } from "@/components/verify/export-json-button";
import { VerificationResults } from "@/components/verify/verification-results";
import { OverallResultBadge } from "@/components/verify/status-badge";
import { cn } from "@/lib/utils";

function BatchSummary({ response }: { response: BatchVerifyResponse }) {
  const passCount = response.items.filter((item) => item.overall === "PASS").length;
  const failCount = response.items.filter((item) => item.overall === "FAIL").length;
  const reviewCount = response.items.filter(
    (item) => item.overall === "REVIEW"
  ).length;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Batch summary</p>
          <p className="mt-1 font-semibold text-xl">
            {response.completed} of {response.total} labels processed
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            {passCount} pass · {reviewCount} review · {failCount} fail
          </p>
        </div>
        <ExportJsonButton
          data={response}
          filename="ttb-batch-verification.json"
        />
      </div>
    </div>
  );
}

function BatchItemCard({ item }: { item: BatchItemResult }) {
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
          <VerificationResults className="space-y-4" response={item} />
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
  return (
    <section className={cn("space-y-6", className)}>
      <BatchSummary response={response} />

      <div className="grid gap-3">
        {response.items.map((item) => (
          <BatchItemCard item={item} key={item.filename} />
        ))}
      </div>
    </section>
  );
}
