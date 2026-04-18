import { encodeSelection } from "./encoder";
import { DEFAULT_PORTS, startBridge, type BridgeHandle } from "./bridge";
import type { EagleItemLike } from "./types";

declare const eagle: {
  item: { getSelected: () => Promise<EagleItemLike[]> };
  onPluginCreate?: (cb: () => void | Promise<void>) => void;
  onPluginRun?: (cb: () => void | Promise<void>) => void;
};

interface UiHooks {
  setStatus(text: string): void;
  showSession(port: number, code: string, imageCount: number, skipped: { name: string; reason: string }[]): void;
  showEmpty(): void;
  showError(message: string): void;
}

let activeBridge: BridgeHandle | null = null;

async function run(ui: UiHooks): Promise<void> {
  try {
    if (activeBridge) {
      await activeBridge.close();
      activeBridge = null;
    }

    ui.setStatus("Reading selection…");
    const selected = await eagle.item.getSelected();
    if (!selected || selected.length === 0) {
      ui.showEmpty();
      return;
    }

    ui.setStatus(`Encoding ${selected.length} item${selected.length === 1 ? "" : "s"}…`);
    const { images, skipped } = await encodeSelection(selected);

    if (images.length === 0) {
      ui.showError(
        skipped.length > 0
          ? `Nothing exportable (${skipped.length} skipped). Select PNG/JPG/GIF images.`
          : "Nothing exportable in selection.",
      );
      return;
    }

    ui.setStatus("Starting local bridge…");
    const bridge = await startBridge({ images, preferredPorts: DEFAULT_PORTS });
    activeBridge = bridge;
    ui.showSession(bridge.port, bridge.code, images.length, skipped);
  } catch (err) {
    ui.showError((err as Error).message ?? String(err));
  }
}

function bindUi(): UiHooks {
  const portEl = document.getElementById("port")!;
  const codeEl = document.getElementById("code")!;
  const statusEl = document.getElementById("status")!;
  const countEl = document.getElementById("count")!;
  const skippedEl = document.getElementById("skipped")!;
  const sessionEl = document.getElementById("session")!;
  const emptyEl = document.getElementById("empty")!;
  const errorEl = document.getElementById("error")!;

  function hideAll(): void {
    sessionEl.hidden = true;
    emptyEl.hidden = true;
    errorEl.hidden = true;
  }

  return {
    setStatus(text) {
      statusEl.textContent = text;
    },
    showSession(port, code, imageCount, skipped) {
      hideAll();
      portEl.textContent = String(port);
      codeEl.textContent = code;
      countEl.textContent = String(imageCount);
      skippedEl.innerHTML = "";
      if (skipped.length > 0) {
        const header = document.createElement("div");
        header.className = "skipped-header";
        header.textContent = `${skipped.length} skipped:`;
        skippedEl.appendChild(header);
        for (const s of skipped) {
          const row = document.createElement("div");
          row.className = "skipped-row";
          row.textContent = `• ${s.name} — ${s.reason}`;
          skippedEl.appendChild(row);
        }
      }
      sessionEl.hidden = false;
      statusEl.textContent = "Ready. Open FigJam → Plugins → Eagle Bridge.";
    },
    showEmpty() {
      hideAll();
      emptyEl.hidden = false;
      statusEl.textContent = "";
    },
    showError(message) {
      hideAll();
      errorEl.textContent = message;
      errorEl.hidden = false;
      statusEl.textContent = "";
    },
  };
}

function boot(): void {
  console.log("[eagle-to-figjam] boot");
  try {
    const ui = bindUi();
    const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement | null;
    const retryBtn = document.getElementById("retry-btn") as HTMLButtonElement | null;

    copyBtn?.addEventListener("click", () => {
      const port = document.getElementById("port")?.textContent ?? "";
      const code = document.getElementById("code")?.textContent ?? "";
      void navigator.clipboard.writeText(`${port} ${code}`);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy port + code"), 1200);
    });

    retryBtn?.addEventListener("click", () => {
      void run(ui);
    });

    const start = (): void => void run(ui);
    if (typeof eagle !== "undefined" && typeof eagle.onPluginCreate === "function") {
      ui.setStatus("Waiting for Eagle…");
      eagle.onPluginCreate(start);
      if (typeof eagle.onPluginRun === "function") eagle.onPluginRun(start);
    } else {
      start();
    }
  } catch (err) {
    console.error("[eagle-to-figjam] boot failed", err);
    document.body.innerHTML =
      `<pre style="color:#ff6b6b;background:#111418;padding:20px;font:12px monospace;white-space:pre-wrap;">` +
      `Send to FigJam failed to start:\n\n${(err as Error).stack ?? (err as Error).message ?? String(err)}` +
      `</pre>`;
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

window.addEventListener("beforeunload", () => {
  void activeBridge?.close();
});
