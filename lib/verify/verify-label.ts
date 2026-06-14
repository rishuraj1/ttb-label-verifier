import { generateText, streamObject } from "ai";
import { buildExpectedValues, mergeVerificationResults } from "./merge-results";
import { preprocessLabelImage } from "./image";
import {
  buildRejectionPrompt,
  buildVerificationPrompt,
  REJECTION_SYSTEM_PROMPT,
} from "./prompts";
import { getVerificationModel } from "./provider";
import { refineVerificationResults } from "./refine-results";
import { computeOverallResult } from "./scoring";
import {
  aiVerificationSchema,
  type AiFieldExtraction,
  type ApplicationFields,
  type VerificationResult,
  type VerifyResponse,
} from "./types";

export type VerifyLabelOptions = {
  mimeType?: string | null;
  filename?: string;
  onFieldComplete?: (field: VerificationResult) => void | Promise<void>;
};

export type VerifyLabelResponse = VerifyResponse & {
  processingTimeMs: number;
};

function isCompleteAiField(f: unknown): f is AiFieldExtraction {
  if (!f || typeof f !== "object") return false;
  const obj = f as Record<string, unknown>;
  return (
    typeof obj.field === "string" &&
    typeof obj.status === "string" &&
    typeof obj.confidence === "number" &&
    typeof obj.explanation === "string" &&
    obj.explanation.length > 0 &&
    "extracted" in obj
  );
}

export async function verifyLabelImage(
  imageBuffer: Buffer,
  fields: ApplicationFields,
  options?: VerifyLabelOptions
): Promise<VerifyLabelResponse> {
  const start = Date.now();
  const { buffer, mimeType } = await preprocessLabelImage(
    imageBuffer,
    options?.mimeType,
    options?.filename
  );

  const model = getVerificationModel();
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: buildVerificationPrompt(fields) },
        { type: "image" as const, image: buffer, mediaType: mimeType },
      ],
    },
  ];

  const { partialObjectStream, object: finalObject } = streamObject({
    model,
    schema: aiVerificationSchema,
    messages,
  });

  const expectedValues = buildExpectedValues(fields);
  const results: VerificationResult[] = [];
  const seenIndices = new Set<number>();

  for await (const partial of partialObjectStream) {
    if (!partial.fields) continue;
    for (let i = 0; i < partial.fields.length; i++) {
      if (seenIndices.has(i)) continue;
      const f = partial.fields[i];
      if (isCompleteAiField(f)) {
        seenIndices.add(i);
        const merged: VerificationResult = {
          field: f.field,
          status: f.status,
          extracted: f.extracted,
          expected: expectedValues[f.field] ?? "",
          confidence: f.confidence,
          explanation: f.explanation,
        };
        const [refined] = refineVerificationResults([merged]);
        results.push(refined);
        await options?.onFieldComplete?.(refined);
      }
    }
  }

  // Fill in any fields the AI omitted
  const aiResult = await finalObject;
  const allMerged = mergeVerificationResults(aiResult, fields);
  for (const item of allMerged) {
    if (!results.some((r) => r.field === item.field)) {
      const [refined] = refineVerificationResults([item]);
      results.push(refined);
      await options?.onFieldComplete?.(refined);
    }
  }

  const overall = computeOverallResult(results);
  let rejectionDraft: string | null = null;

  if (overall === "FAIL") {
    const failedResults = results.filter((result) => result.status === "fail");
    const { text } = await generateText({
      model,
      system: REJECTION_SYSTEM_PROMPT,
      prompt: buildRejectionPrompt(failedResults),
    });
    rejectionDraft = text;
  }

  return {
    overall,
    results,
    rejectionDraft,
    processingTimeMs: Date.now() - start,
  };
}
