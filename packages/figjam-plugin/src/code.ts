import { base64ToBytes, layoutGrid } from "./layout";
import type { PluginEvent, PluginMessage } from "./shared";

figma.showUI(__html__, { width: 360, height: 300, title: "Eagle Bridge" });

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === "cancel") {
    figma.closePlugin();
    return;
  }
  if (msg.type !== "import") return;

  try {
    const { images } = msg;
    if (images.length === 0) {
      send({ type: "error", message: "No images in payload." });
      return;
    }

    const slots = layoutGrid(images.map((i) => ({ width: i.width, height: i.height })), {
      columns: 4,
      gap: 24,
      originX: figma.viewport.center.x,
      originY: figma.viewport.center.y,
    });

    const nodes: SceneNode[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i]!;
      const slot = slots[i]!;
      const bytes = base64ToBytes(img.b64);
      const figImage = figma.createImage(bytes);
      const rect = figma.createRectangle();
      rect.name = img.name;
      rect.resize(Math.max(1, slot.width), Math.max(1, slot.height));
      rect.x = slot.x;
      rect.y = slot.y;
      rect.fills = [{ type: "IMAGE", imageHash: figImage.hash, scaleMode: "FILL" }];
      figma.currentPage.appendChild(rect);
      nodes.push(rect);
    }

    if (nodes.length > 1) {
      const group = figma.group(nodes, figma.currentPage);
      group.name = `Eagle import (${nodes.length})`;
      figma.viewport.scrollAndZoomIntoView([group]);
      figma.currentPage.selection = [group];
    } else if (nodes.length === 1) {
      figma.viewport.scrollAndZoomIntoView(nodes);
      figma.currentPage.selection = nodes;
    }

    figma.notify(`Imported ${nodes.length} image${nodes.length === 1 ? "" : "s"} from Eagle`);
    send({ type: "done", count: nodes.length });
  } catch (err) {
    send({ type: "error", message: (err as Error).message ?? String(err) });
  }
};

function send(event: PluginEvent): void {
  figma.ui.postMessage(event);
}
