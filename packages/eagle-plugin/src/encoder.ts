import { promises as fs } from "node:fs";
import {
  MAX_DIMENSION,
  SUPPORTED_EXTS,
  type EagleItemLike,
  type EncodeResult,
  type EncodedImage,
  type SupportedExt,
} from "./types";

type SharpFactory = (input: Buffer) => {
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(opts: { width?: number; height?: number; fit: "inside"; withoutEnlargement: true }): {
    toFormat(fmt: "png" | "jpeg" | "gif"): { toBuffer(): Promise<Buffer> };
  };
};

function loadSharp(): SharpFactory | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("sharp") as SharpFactory;
  } catch {
    return null;
  }
}

export function normalizeExt(raw: string): SupportedExt | null {
  const lower = raw.toLowerCase().replace(/^\./, "");
  return (SUPPORTED_EXTS as readonly string[]).includes(lower) ? (lower as SupportedExt) : null;
}

function formatFor(ext: SupportedExt): "png" | "jpeg" | "gif" {
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "gif") return "gif";
  return "png";
}

export async function encodeImage(
  item: EagleItemLike,
  deps: { readFile?: typeof fs.readFile; sharp?: SharpFactory | null } = {},
): Promise<EncodedImage | { skipped: true; reason: string }> {
  const ext = normalizeExt(item.ext);
  if (!ext) return { skipped: true, reason: `unsupported type: .${item.ext}` };

  const readFile = deps.readFile ?? fs.readFile;
  let bytes: Buffer;
  try {
    bytes = await readFile(item.filePath);
  } catch (err) {
    return { skipped: true, reason: `read failed: ${(err as Error).message}` };
  }

  let width = item.width ?? 0;
  let height = item.height ?? 0;

  const needsResize = Math.max(width, height) > MAX_DIMENSION || width === 0 || height === 0;
  if (needsResize) {
    const sharp = deps.sharp === undefined ? loadSharp() : deps.sharp;
    if (!sharp) {
      // No sharp available — if dimensions unknown, pass through; if too large, skip.
      if (Math.max(width, height) > MAX_DIMENSION) {
        return { skipped: true, reason: `exceeds ${MAX_DIMENSION}px and sharp not installed` };
      }
    } else {
      const pipeline = sharp(bytes);
      const meta = await pipeline.metadata();
      width = meta.width ?? width;
      height = meta.height ?? height;
      if (Math.max(width, height) > MAX_DIMENSION) {
        const fitted = await sharp(bytes)
          .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
          .toFormat(formatFor(ext))
          .toBuffer();
        bytes = fitted;
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
    }
  }

  return {
    name: item.name,
    ext,
    width,
    height,
    b64: bytes.toString("base64"),
  };
}

export async function encodeSelection(
  items: EagleItemLike[],
  deps?: { readFile?: typeof fs.readFile; sharp?: SharpFactory | null },
): Promise<EncodeResult> {
  const images: EncodedImage[] = [];
  const skipped: EncodeResult["skipped"] = [];
  for (const item of items) {
    const result = await encodeImage(item, deps);
    if ("skipped" in result) {
      skipped.push({ name: item.name, reason: result.reason });
    } else {
      images.push(result);
    }
  }
  return { images, skipped };
}
