import { generateObject, generateText } from "ai";
import { mergeVerificationResults } from "./merge-results";
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

  const { object: aiResult } = await generateObject({
    model,
    schema: aiVerificationSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildVerificationPrompt(fields) },
          { type: "image", image: buffer, mediaType: mimeType },
        ],
      },
    ],
  });

  const merged = mergeVerificationResults(aiResult, fields);
  const results: VerificationResult[] = [];

  for (const item of merged) {
    const [refined] = refineVerificationResults([item]);
    results.push(refined);
    await options?.onFieldComplete?.(refined);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
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
