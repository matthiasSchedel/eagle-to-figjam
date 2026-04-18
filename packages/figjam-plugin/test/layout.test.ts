import { describe, expect, it } from "vitest";
import { base64ToBytes, layoutGrid } from "../src/layout";

describe("layoutGrid", () => {
  it("places items in row-major order with gaps", () => {
    const slots = layoutGrid(
      [
        { width: 100, height: 100 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ],
      { columns: 2, gap: 10, originX: 0, originY: 0 },
    );
    expect(slots).toEqual([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 110, y: 0, width: 100, height: 100 },
      { x: 0, y: 110, width: 100, height: 100 },
    ]);
  });

  it("scales oversized items down to max dimension", () => {
    const [slot] = layoutGrid([{ width: 8000, height: 4000 }], { maxDimension: 4096 });
    expect(slot).toBeDefined();
    expect(slot!.width).toBeCloseTo(4096);
    expect(slot!.height).toBeCloseTo(2048);
  });

  it("centers shorter items within row height", () => {
    const slots = layoutGrid(
      [
        { width: 100, height: 200 },
        { width: 100, height: 100 },
      ],
      { columns: 2, gap: 0, originX: 0, originY: 0 },
    );
    expect(slots[0]!.y).toBe(0);
    // second item should be offset down by (200 - 100) / 2 = 50
    expect(slots[1]!.y).toBe(50);
  });

  it("offsets by origin", () => {
    const [slot] = layoutGrid([{ width: 10, height: 10 }], { originX: 500, originY: 300 });
    expect(slot).toEqual({ x: 500, y: 300, width: 10, height: 10 });
  });
});

describe("base64ToBytes", () => {
  it("round-trips ascii", () => {
    const bytes = base64ToBytes("aGVsbG8=");
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });
});
