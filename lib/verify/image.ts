import sharp from "sharp";
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  type LabelImageMimeType,
} from "./constants";

const MIME_BY_FORMAT: Record<string, LabelImageMimeType> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type PreprocessedLabelImage = {
  buffer: Buffer;
  mimeType: LabelImageMimeType;
};

function mimeFromFilename(filename: string): LabelImageMimeType | null {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

export async function preprocessLabelImage(
  buffer: Buffer,
  hintMimeType?: string | null,
  filename?: string
): Promise<PreprocessedLabelImage> {
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image must be less than 10MB");
  }

  let pipeline = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await pipeline.metadata();

  const formatMime =
    metadata.format && MIME_BY_FORMAT[metadata.format]
      ? MIME_BY_FORMAT[metadata.format]
      : null;
  const filenameMime = filename ? mimeFromFilename(filename) : null;
  const hintMime = IMAGE_MIME_TYPES.includes(hintMimeType as LabelImageMimeType)
    ? (hintMimeType as LabelImageMimeType)
    : null;

  const mimeType = formatMime ?? filenameMime ?? hintMime;

  if (!mimeType) {
    throw new Error("Image must be JPEG, PNG, or WebP");
  }

  if (
    metadata.width &&
    metadata.height &&
    (metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION)
  ) {
    pipeline = pipeline.resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let output = await pipeline.toBuffer();

  if (output.byteLength > MAX_IMAGE_BYTES) {
    output = await sharp(output)
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return { buffer: output, mimeType: "image/jpeg" };
  }

  return { buffer: output, mimeType };
}
