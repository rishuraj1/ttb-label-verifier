"use client";

import JSZip from "jszip";
import { FileArchiveIcon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import {
  appendApplicationFields,
  ApplicationFieldsSection,
  type ApplicationFormFieldId,
  emptyApplicationFormState,
} from "@/components/verify/application-fields";
import { BatchResults } from "@/components/verify/batch-results";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  BATCH_CONCURRENCY,
  MAX_BATCH_IMAGES,
} from "@/lib/verify/constants";
import { computeBatchSummary } from "@/lib/verify/batch-summary";
import type {
  BatchItemResult,
  BatchVerifyResponse,
  VerifyResponse,
} from "@/lib/verify/types";
import { cn } from "@/lib/utils";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function isImageFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

async function extractImagesFromClientZip(
  archive: File
): Promise<Array<{ filename: string; file: File }>> {
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  const images: Array<{ filename: string; file: File }> = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !isImageFilename(path)) {
      continue;
    }

    const filename = path.split("/").pop() ?? path;
    const blob = await entry.async("blob");
    const mimeType = filename.toLowerCase().endsWith(".png")
      ? "image/png"
      : filename.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    images.push({
      filename,
      file: new File([blob], filename, { type: mimeType }),
    });
  }

  return images;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));

  return results;
}

async function verifySingleImage(
  file: File,
  formValues: Record<ApplicationFormFieldId, string>
): Promise<VerifyResponse> {
  const formData = new FormData();
  formData.append("image", file);
  appendApplicationFields(formData, formValues);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const verifyResponse = await fetch(`${basePath}/api/verify`, {
    method: "POST",
    body: formData,
  });

  const data = await verifyResponse.json();

  if (!verifyResponse.ok) {
    throw new Error(data.error ?? "Verification request failed");
  }

  return data as VerifyResponse;
}

export function BatchForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formValues, setFormValues] = useState(emptyApplicationFormState);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [response, setResponse] = useState<BatchVerifyResponse | null>(null);

  const handleFieldChange = (id: ApplicationFormFieldId, value: string) => {
    setFormValues((current) => ({ ...current, [id]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!archiveFile) {
      toast.error("Please upload a ZIP archive");
      return;
    }

    setIsSubmitting(true);
    setResponse(null);

    try {
      const images = await extractImagesFromClientZip(archiveFile);

      if (images.length === 0) {
        throw new Error("ZIP archive must contain JPEG, PNG, or WebP label images");
      }

      if (images.length > MAX_BATCH_IMAGES) {
        throw new Error(`ZIP archive may contain at most ${MAX_BATCH_IMAGES} images`);
      }

      setProgress({ completed: 0, total: images.length });

      let completed = 0;

      const items = await runWithConcurrency(
        images,
        BATCH_CONCURRENCY,
        async (image): Promise<BatchItemResult> => {
          try {
            const result = await verifySingleImage(image.file, formValues);
            completed += 1;
            setProgress({ completed, total: images.length });

            return {
              filename: image.filename,
              ...result,
              error: null,
            };
          } catch (error) {
            completed += 1;
            setProgress({ completed, total: images.length });

            return {
              filename: image.filename,
              overall: "FAIL",
              results: [],
              rejectionDraft: null,
              error:
                error instanceof Error ? error.message : "Verification failed",
            };
          }
        }
      );

      setResponse({
        total: items.length,
        completed: items.length,
        items,
        summary: computeBatchSummary(items),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Batch verification failed"
      );
    } finally {
      setIsSubmitting(false);
      setProgress({ completed: 0, total: 0 });
    }
  };

  return (
    <div className="space-y-8">
      {response ? <BatchResults response={response} /> : null}

      <form className="space-y-8" onSubmit={handleSubmit}>
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-medium text-lg">ZIP archive</h2>

          <button
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors hover:bg-muted/50",
              archiveFile && "border-solid py-6"
            )}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            type="button"
          >
            <FileArchiveIcon
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            {archiveFile ? (
              <span className="font-medium text-sm">{archiveFile.name}</span>
            ) : (
              <span className="text-muted-foreground text-sm">
                Click to upload a ZIP of label images (up to {MAX_BATCH_IMAGES}{" "}
                JPEG, PNG, or WebP files)
              </span>
            )}
          </button>

          <input
            accept=".zip,application/zip,application/x-zip-compressed"
            className="sr-only"
            onChange={(event) => {
              setArchiveFile(event.target.files?.[0] ?? null);
            }}
            ref={fileInputRef}
            type="file"
          />
        </section>

        <ApplicationFieldsSection
          idPrefix="batch-"
          onChange={handleFieldChange}
          values={formValues}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={isSubmitting} size="lg" type="submit">
            {isSubmitting ? <Spinner className="size-4" /> : null}
            {isSubmitting
              ? progress.total > 0
                ? `Verifying ${progress.completed}/${progress.total}…`
                : "Preparing batch…"
              : "Verify batch"}
          </Button>

          {response ? (
            <Button
              onClick={() => setResponse(null)}
              size="lg"
              type="button"
              variant="outline"
            >
              New batch
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
