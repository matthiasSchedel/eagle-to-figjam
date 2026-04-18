export type SupportedExt = "png" | "jpg" | "jpeg" | "gif";

export const SUPPORTED_EXTS: readonly SupportedExt[] = ["png", "jpg", "jpeg", "gif"] as const;

export const MAX_DIMENSION = 4096;

export interface EncodedImage {
  name: string;
  ext: SupportedExt;
  width: number;
  height: number;
  b64: string;
}

export interface SkippedItem {
  name: string;
  reason: string;
}

export interface EncodeResult {
  images: EncodedImage[];
  skipped: SkippedItem[];
}

export interface SessionPayload {
  code: string;
  createdAt: number;
  images: EncodedImage[];
}

export interface EagleItemLike {
  name: string;
  ext: string;
  filePath: string;
  width?: number;
  height?: number;
}
