export interface BridgeImage {
  name: string;
  ext: "png" | "jpg" | "jpeg" | "gif";
  width: number;
  height: number;
  b64: string;
}

export interface BridgeResponse {
  code: string;
  createdAt: number;
  images: BridgeImage[];
}

export type PluginMessage =
  | { type: "run"; images: BridgeImage[] }
  | { type: "cancel" };

export type PluginEvent =
  | { type: "done"; count: number }
  | { type: "error"; message: string };
