import { describe, expect, it } from "vitest";
import { encodeImage, encodeSelection, normalizeExt } from "../src/encoder";
import type { EagleItemLike } from "../src/types";

const png1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000000500010d0a2db40000000049454e44ae426082",
  "hex",
);

describe("normalizeExt", () => {
  it.each([
    ["png", "png"],
    [".PNG", "png"],
    ["JPG", "jpg"],
    ["jpeg", "jpeg"],
    ["gif", "gif"],
    ["mp4", null],
    ["webp", null],
    ["", null],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(normalizeExt(input)).toBe(expected);
  });
});

describe("encodeImage", () => {
  it("encodes a supported image to base64 with known dimensions", async () => {
    const item: EagleItemLike = {
      name: "pixel",
      ext: "png",
      filePath: "/fake/pixel.png",
      width: 1,
      height: 1,
    };
    const result = await encodeImage(item, {
      readFile: async () => png1x1,
      sharp: null,
    });
    expect(result).toMatchObject({
      name: "pixel",
      ext: "png",
      width: 1,
      height: 1,
    });
    if ("skipped" in result) throw new Error("expected encoded");
    expect(Buffer.from(result.b64, "base64").equals(png1x1)).toBe(true);
  });

  it("skips unsupported extensions", async () => {
    const result = await encodeImage(
      { name: "v", ext: "mp4", filePath: "/x.mp4", width: 10, height: 10 },
      { readFile: async () => Buffer.from([]), sharp: null },
    );
    expect(result).toEqual({ skipped: true, reason: expect.stringContaining("unsupported") });
  });

  it("skips when file read fails", async () => {
    const result = await encodeImage(
      { name: "x", ext: "png", filePath: "/nope.png", width: 1, height: 1 },
      {
        readFile: async () => {
          throw new Error("ENOENT");
        },
        sharp: null,
      },
    );
    expect(result).toEqual({ skipped: true, reason: expect.stringContaining("ENOENT") });
  });

  it("skips oversized image when sharp not installed", async () => {
    const result = await encodeImage(
      { name: "big", ext: "png", filePath: "/big.png", width: 8000, height: 4000 },
      { readFile: async () => png1x1, sharp: null },
    );
    expect(result).toEqual({ skipped: true, reason: expect.stringContaining("4096") });
  });

  it("downscales oversized image when sharp is available", async () => {
    const resized = Buffer.from([1, 2, 3, 4]);
    const sharpMock = () => ({
      metadata: async () => ({ width: 8000, height: 4000 }),
      resize: () => ({
        toFormat: () => ({
          toBuffer: async () => resized,
        }),
      }),
    });
    const result = await encodeImage(
      { name: "big", ext: "png", filePath: "/big.png", width: 8000, height: 4000 },
      { readFile: async () => Buffer.from([0]), sharp: sharpMock as never },
    );
    if ("skipped" in result) throw new Error(`unexpected skip: ${result.reason}`);
    expect(result.width).toBe(4096);
    expect(result.height).toBe(2048);
    expect(Buffer.from(result.b64, "base64").equals(resized)).toBe(true);
  });
});

describe("encodeSelection", () => {
  it("returns images and skipped lists", async () => {
    const { images, skipped } = await encodeSelection(
      [
        { name: "a", ext: "png", filePath: "/a.png", width: 1, height: 1 },
        { name: "b", ext: "mp4", filePath: "/b.mp4", width: 1, height: 1 },
      ],
      { readFile: async () => png1x1, sharp: null },
    );
    expect(images).toHaveLength(1);
    expect(skipped).toEqual([{ name: "b", reason: expect.stringContaining("unsupported") }]);
  });
});
