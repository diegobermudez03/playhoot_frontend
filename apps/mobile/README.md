# apps/mobile

The future mobile host: React Native + Expo shell with a dedicated restricted WebView for the game (`NativeGameHost`) (plan §2, §10, §18 step 11).

Status: NOT STARTED, intentionally. The plan builds the mobile shell after the web vertical slice is complete. Nothing in `packages/` may assume web-only APIs where the package is meant to be shared (see `ARCHITECTURE.md`), so this app can reuse protocol, communication and feature state when it is created.

The same GameVersion frontend artifact that runs in the web iframe must run unchanged here.
