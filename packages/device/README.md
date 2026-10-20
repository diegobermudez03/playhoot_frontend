# @playhoot/device

Device capabilities and display abstraction.

Status: FOUNDATION: `DeviceCapabilities`, `classifyDisplay`, capabilities store. Platform detection lives in each app. Repository-wide implementation state: `CURRENT_STATE.md` at the root.

## Owns

The shared `DeviceCapabilities` abstraction (plan §7): touch, keyboard, pointer, gamepad, viewport/display dimensions, orientation/display class. Platform adapters (web now, mobile later) implement detection; presentation uses it to pick variants; feature state reads it only when it is a real business input.

## Does not own

- Game compatibility decisions (made before the game loads, from the GameVersion manifest plus detected capabilities).
- Layout: variant selection lives at the presentation edge in the apps.

## Depends on

- Nothing internal.

## External dependencies

- zustand (vanilla store only)

Architecture rules: `ARCHITECTURE.md`. Plan section references (§N) point to `docs/Playhoot_Frontend_Architecture_Plan.docx`.
