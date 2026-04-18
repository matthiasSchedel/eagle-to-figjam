export interface LayoutInput {
  width: number;
  height: number;
}

export interface LayoutSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutOptions {
  columns?: number;
  gap?: number;
  originX?: number;
  originY?: number;
  maxDimension?: number;
}

// Row-major grid layout. Each row's height = max image height in that row.
// Items that exceed maxDimension get uniformly scaled down into the slot.
export function layoutGrid(items: LayoutInput[], opts: LayoutOptions = {}): LayoutSlot[] {
  const columns = Math.max(1, opts.columns ?? 4);
  const gap = opts.gap ?? 24;
  const originX = opts.originX ?? 0;
  const originY = opts.originY ?? 0;
  const maxDim = opts.maxDimension ?? 4096;

  const slots: LayoutSlot[] = [];
  let rowStart = 0;
  let cursorY = originY;

  while (rowStart < items.length) {
    const rowEnd = Math.min(rowStart + columns, items.length);
    const row = items.slice(rowStart, rowEnd).map((item) => {
      const scale = Math.max(item.width, item.height) > maxDim
        ? maxDim / Math.max(item.width, item.height)
        : 1;
      return { width: item.width * scale, height: item.height * scale };
    });

    const rowHeight = row.reduce((h, s) => Math.max(h, s.height), 0);
    let cursorX = originX;
    for (const slot of row) {
      // Vertically center within the row's baseline.
      const yOffset = (rowHeight - slot.height) / 2;
      slots.push({ x: cursorX, y: cursorY + yOffset, width: slot.width, height: slot.height });
      cursorX += slot.width + gap;
    }

    cursorY += rowHeight + gap;
    rowStart = rowEnd;
  }

  return slots;
}

export function base64ToBytes(b64: string): Uint8Array {
  // Works in both browser (atob) and node (Buffer) contexts; used in plugin sandbox (browser-like).
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
