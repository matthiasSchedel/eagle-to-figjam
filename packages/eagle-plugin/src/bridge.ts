import { createServer, type Server } from "node:http";
import { randomInt } from "node:crypto";
import type { SessionPayload, EncodedImage } from "./types";

const TTL_MS = 5 * 60 * 1000;
const HOST = "127.0.0.1";

// Fixed port range so the FigJam manifest's allowedDomains can be explicit
// (Figma rejects port wildcards in allowedDomains).
export const DEFAULT_PORTS = [41783, 41784, 41785, 41786, 41787, 41788, 41789, 41790];

export interface BridgeHandle {
  port: number;
  code: string;
  close: () => Promise<void>;
  server: Server;
}

export interface StartBridgeOpts {
  images: EncodedImage[];
  ttlMs?: number;
  now?: () => number;
  code?: string;
  /** Ports to try in order. If empty, uses an OS-assigned ephemeral port. */
  preferredPorts?: number[];
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function startBridge(opts: StartBridgeOpts): Promise<BridgeHandle> {
  const ttl = opts.ttlMs ?? TTL_MS;
  const now = opts.now ?? Date.now;
  const code = opts.code ?? generateCode();
  const payload: SessionPayload = { code, createdAt: now(), images: opts.images };

  let consumed = false;
  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${HOST}`);
    if (url.pathname !== "/session") {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    if (now() - payload.createdAt > ttl) {
      res.writeHead(410);
      res.end(JSON.stringify({ error: "expired" }));
      void close();
      return;
    }

    if (req.method === "DELETE") {
      res.writeHead(204);
      res.end();
      void close();
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    const suppliedCode = url.searchParams.get("code");
    if (suppliedCode !== code) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "bad_code" }));
      return;
    }

    if (consumed) {
      res.writeHead(410);
      res.end(JSON.stringify({ error: "already_consumed" }));
      return;
    }
    consumed = true;

    const body = JSON.stringify(payload);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);

    // Close shortly after delivering so the OS can release the port.
    setTimeout(() => {
      void close();
    }, 50).unref?.();
  });

  const ttlTimer = setTimeout(() => {
    void close();
  }, ttl);
  ttlTimer.unref?.();

  async function close(): Promise<void> {
    clearTimeout(ttlTimer);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  const ports = opts.preferredPorts && opts.preferredPorts.length > 0 ? opts.preferredPorts : [0];
  return tryListen(server, ports).then((port) => ({ port, code, close, server }));
}

function tryListen(server: Server, ports: number[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const errors: string[] = [];
    const attempt = (idx: number): void => {
      if (idx >= ports.length) {
        reject(new Error(`bridge: no free port in range (${errors.join(", ")})`));
        return;
      }
      const port = ports[idx]!;
      const onError = (err: NodeJS.ErrnoException): void => {
        errors.push(`${port}:${err.code ?? err.message}`);
        server.removeListener("error", onError);
        if (err.code === "EADDRINUSE") {
          attempt(idx + 1);
        } else {
          reject(err);
        }
      };
      server.once("error", onError);
      server.listen(port, HOST, () => {
        server.removeListener("error", onError);
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("bridge: failed to resolve bound address"));
          return;
        }
        resolve(addr.port);
      });
    };
    attempt(0);
  });
}
