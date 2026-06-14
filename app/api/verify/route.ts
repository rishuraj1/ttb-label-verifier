import { auth } from "@/app/(auth)/auth";
import { verifyLabelImage } from "@/lib/verify/verify-label";
import type { ApplicationFields } from "@/lib/verify/types";
import { parseVerifyFormData } from "./schema";

export const maxDuration = 60;

function wantsStream(request: Request, formData: FormData): boolean {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream")) {
    return true;
  }

  return formData.get("stream") === "1";
}

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const { image, ...fields } = parseVerifyFormData(formData);
    const applicationFields = fields as ApplicationFields;
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const stream = wantsStream(request, formData);

    if (!stream) {
      const response = await verifyLabelImage(imageBuffer, applicationFields, {
        mimeType: image.type,
        filename: image instanceof File ? image.name : undefined,
      });

      return Response.json(response);
    }

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEncode(event, data)));
        };

        try {
          const result = await verifyLabelImage(
            imageBuffer,
            applicationFields,
            {
              mimeType: image.type,
              filename: image instanceof File ? image.name : undefined,
              onFieldComplete: (field) => {
                send("field", field);
              },
            }
          );

          send("complete", result);
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Verification failed";
          send("error", { error: message, code: "INTERNAL_ERROR" });
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";

    return Response.json({ error: message }, { status: 400 });
  }
}
