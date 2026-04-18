# eagle-to-figjam

One-click export of images selected in [Eagle](https://eagle.cool) onto the [FigJam](https://www.figma.com/figjam/) canvas.

![status](https://img.shields.io/badge/status-early-orange) ![license](https://img.shields.io/badge/license-MIT-blue)

```
┌────────────────────┐   localhost:<port>/session   ┌──────────────────────┐
│ Eagle Plugin       │ ───────────────────────────► │ FigJam Plugin        │
│ getSelected() →    │   JSON: { code, images[] }   │ createImage + rect   │
│ fs → base64        │ ◄─────────────────────────── │ grid layout + group  │
└────────────────────┘                              └──────────────────────┘
```

## How it works

Two plugins talk over a short-lived local HTTP bridge:

1. **Eagle plugin** — reads the current selection, encodes the images to base64, starts a localhost server on an ephemeral port, and shows a 6-digit pairing code.
2. **FigJam plugin** — you paste the port + code, it pulls the images, and places each one as a rectangle with an image fill in a neat grid on the canvas.

The server binds to `127.0.0.1` on a fixed port range (`41783`–`41790`; first free one wins) so the FigJam manifest can allowlist exact URLs. It auto-closes after one successful pull or 5 minutes and requires the pairing code as a query param.

## Install (developer mode)

```bash
npm install
npm run build
```

### Eagle
After `npm run build`, Eagle → **Plugin** → **Developer** → **Import Local Project** → pick `packages/eagle-plugin/` (the folder containing `manifest.json`, not `dist/`). The manifest points at `dist/ui.html` internally.

### FigJam (Figma desktop)
Plugins → **Development** → **Import plugin from manifest…** → pick `packages/figjam-plugin/manifest.json`.

## Use

1. Select one or more images in Eagle.
2. Run the **Send to FigJam** plugin → copy the shown port + code.
3. In your FigJam file: **Plugins → Development → Eagle Bridge**. Paste port + code → click Import.
4. Images land at the current viewport center, grouped, 4 columns.

## Dev

```bash
npm run dev         # watches both packages
npm test            # vitest
npm run typecheck
```

## Limits

- PNG / JPG / GIF only. Other files in the selection are skipped.
- Images larger than 4096 px on the longest edge are downscaled before upload (Figma plugin API limit). Downscale requires `sharp`; if unavailable, oversized images are skipped with a warning.
- Both apps must be on the same machine (loopback only).
- Sessions are one-shot and expire after 5 minutes. Re-run the Eagle plugin for a fresh code.
- Bridge uses one of ports `41783`–`41790`. If all are busy, the plugin reports an error.
- In Figma, local development plugins show a generic placeholder icon — that's a Figma UX quirk, not a bug in this plugin. Community-published builds will have a proper icon.

## Security

- Bridge binds to `127.0.0.1` only — never exposed on the network.
- Pairing requires a 6-digit code sent as a query param; without it, every request returns `401`.
- Server auto-closes after the first successful pull, on explicit `DELETE /session`, or after a 5-minute TTL.

## Contributing

Tests are `vitest`. New features should add a test first. Run `npm run typecheck && npm test` before committing.

## License

[MIT](./LICENSE)
