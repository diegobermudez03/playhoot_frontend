# Assets

Images, audio and video a game needs are declared in `game.project.json` and uploaded separately. Code never embeds them.

## Declaring

```json
{
  "format": "playhoot.project.v1",
  "assets": {
    "cardBack": { "type": "image", "description": "Back of a card, 512x768, dark blue" },
    "flip": { "type": "audio", "description": "Short card flip sound", "optional": true }
  }
}
```

- Key: starts with a letter, up to 64 letters, digits or `_`.
- `type`: `image` (PNG, WebP, JPEG, SVG), `audio` (MP3, OGG, WAV) or `video` (MP4, WebM).
- `description`: what the person should upload, 1 to 300 characters. Be concrete: size, style, length.
- `optional`: `true` when the game works without it. A required asset that is missing blocks publication.

An invalid declaration makes the change `invalid` with a diagnostic on `game.project.json`.

## Uploading

- The person uploads files in the section **Recursos** (id `assets`).
- An agent with HTTP PUTs the raw file to the link's `/assets/<key>` URL with an `Idempotency-Key` header (a new random string per file). The answer is `attached` (a new revision) or `unchanged` (that content was already bound).
- The real type is read from the bytes, never the file name. Limits: image 5 MiB, audio 10 MiB, video 50 MiB, 100 MiB for all assets together.
- `POST <link>/assets/<key>/remove` with `{"idempotency_key": "..."}` unbinds a key.
- Uploading never conflicts with source changes; it makes a new revision on top of the current one.

Reading the link lists every declared asset as `missing` or `ready`, and content bound to a key no longer declared as `undeclared`.

## Using them in the client

`import { assets } from '@playhoot/assets'` gives one handle per declared key, generated from `game.project.json`: an undeclared key is a type error. Only `client/` imports it.

`useAsset(assets.cardBack)` returns `{ status, url }`:

- `loading`: not loaded yet; `url` is `null`.
- `ready`: `url` works in `img`, `audio`, `video` or CSS.
- `missing`: this version holds no file for it (an optional asset nobody uploaded). Render a fallback.
- `error`: it could not be loaded.

Always render something while it is not `ready`. `AssetImage` does it for images:

<!-- example: fixtures/sdk-games/pairs/client/Game.tsx -->
```tsx
              <AssetImage
                asset={assets.cardBack}
                alt=""
                fit="cover"
                fallback={<Text tone="accent">?</Text>}
              />
```

For audio or video, use `useAsset` and give the element `url` once `status` is `ready`.
