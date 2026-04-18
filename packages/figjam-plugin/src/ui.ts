import type { BridgeResponse, PluginEvent, PluginMessage } from "./shared";

const form = document.getElementById("form") as HTMLFormElement;
const portInput = document.getElementById("port") as HTMLInputElement;
const codeInput = document.getElementById("code") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;
const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
const cancelBtn = document.getElementById("cancel-btn") as HTMLButtonElement;

function setStatus(text: string, kind: "info" | "error" | "ok" = "info"): void {
  status.textContent = text;
  status.dataset.kind = kind;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  void doImport();
});

cancelBtn.addEventListener("click", () => {
  post({ type: "cancel" });
});

async function doImport(): Promise<void> {
  const port = portInput.value.trim();
  const code = codeInput.value.trim();

  if (!/^\d{2,6}$/.test(port)) {
    setStatus("Port looks invalid.", "error");
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    setStatus("Code must be 6 digits.", "error");
    return;
  }

  importBtn.disabled = true;
  setStatus("Connecting to Eagle bridge…");

  try {
    const url = `http://127.0.0.1:${port}/session?code=${encodeURIComponent(code)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      setStatus(`Bridge returned ${res.status}. Is the Eagle plugin still open with this code?`, "error");
      importBtn.disabled = false;
      return;
    }
    const payload = (await res.json()) as BridgeResponse;
    if (!payload || !Array.isArray(payload.images) || payload.images.length === 0) {
      setStatus("Bridge returned no images.", "error");
      importBtn.disabled = false;
      return;
    }
    setStatus(`Placing ${payload.images.length} image(s)…`);
    post({ type: "import", images: payload.images });
  } catch (err) {
    setStatus(`Fetch failed: ${(err as Error).message}`, "error");
    importBtn.disabled = false;
  }
}

function post(msg: PluginMessage): void {
  parent.postMessage({ pluginMessage: msg }, "*");
}

window.addEventListener("message", (ev) => {
  const data = (ev.data as { pluginMessage?: PluginEvent }).pluginMessage;
  if (!data) return;
  if (data.type === "done") {
    setStatus(`Imported ${data.count} image${data.count === 1 ? "" : "s"}. Done.`, "ok");
    importBtn.disabled = false;
  } else if (data.type === "error") {
    setStatus(data.message, "error");
    importBtn.disabled = false;
  }
});
