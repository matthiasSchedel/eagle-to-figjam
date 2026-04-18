import { afterEach, describe, expect, it } from "vitest";
import { startBridge } from "../src/bridge";
import type { EncodedImage } from "../src/types";

const sampleImages: EncodedImage[] = [
  { name: "a", ext: "png", width: 10, height: 10, b64: "aGk=" },
];

let cleanup: (() => Promise<void>) | null = null;

afterEach(async () => {
  if (cleanup) {
    await cleanup();
    cleanup = null;
  }
});

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

describe("startBridge", () => {
  it("binds to loopback and serves payload with matching code", async () => {
    const bridge = await startBridge({ images: sampleImages, code: "123456" });
    cleanup = bridge.close;

    const ok = await fetchJson(`http://127.0.0.1:${bridge.port}/session?code=123456`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ code: "123456", images: [{ name: "a" }] });
  });

  it("rejects missing or wrong code with 401", async () => {
    const bridge = await startBridge({ images: sampleImages, code: "111111" });
    cleanup = bridge.close;
    const wrong = await fetchJson(`http://127.0.0.1:${bridge.port}/session?code=222222`);
    expect(wrong.status).toBe(401);
    const missing = await fetchJson(`http://127.0.0.1:${bridge.port}/session`);
    expect(missing.status).toBe(401);
  });

  it("returns 404 for unknown paths", async () => {
    const bridge = await startBridge({ images: sampleImages, code: "111111" });
    cleanup = bridge.close;
    const nf = await fetchJson(`http://127.0.0.1:${bridge.port}/other`);
    expect(nf.status).toBe(404);
  });

  it("serves once then closes after a successful pull", async () => {
    const bridge = await startBridge({ images: sampleImages, code: "111111" });
    cleanup = async () => {};
    const first = await fetchJson(`http://127.0.0.1:${bridge.port}/session?code=111111`);
    expect(first.status).toBe(200);
    // Give the unref'd close timer a moment, then expect ECONNREFUSED.
    await new Promise((r) => setTimeout(r, 150));
    await expect(
      fetch(`http://127.0.0.1:${bridge.port}/session?code=111111`),
    ).rejects.toBeDefined();
  });

  it("expires payload after TTL", async () => {
    let t = 1_000;
    const bridge = await startBridge({
      images: sampleImages,
      code: "111111",
      ttlMs: 50,
      now: () => t,
    });
    cleanup = bridge.close;
    t += 500;
    const res = await fetchJson(`http://127.0.0.1:${bridge.port}/session?code=111111`);
    expect(res.status).toBe(410);
  });
});
