import { auth } from "@/app/(auth)/auth";
import {
  computeBatchSummary,
  extractImagesFromZip,
  runBatchVerification,
} from "@/lib/verify/batch";
import type { ApplicationFields, BatchVerifyResponse } from "@/lib/verify/types";
import { parseBatchVerifyFormData } from "../schema";

export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const { archive, ...fields } = parseBatchVerifyFormData(formData);
    const applicationFields = fields as ApplicationFields;

    const zipBuffer = Buffer.from(await archive.arrayBuffer());
    const images = await extractImagesFromZip(zipBuffer);
    const items = await runBatchVerification(images, applicationFields);

    const response: BatchVerifyResponse = {
      total: items.length,
      completed: items.length,
      items,
      summary: computeBatchSummary(items),
    };

    return Response.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Batch verification failed";

    return Response.json({ error: message }, { status: 400 });
  }
}
