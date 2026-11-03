# UI: layout, controls and presentation

`@playhoot/game-react` ships the pieces most screens need. Use them instead of raw elements: they keep text legible and targets comfortable on every screen, work the same with touch, a mouse, a keyboard and screen readers, and keep the game playable on phones (see "What the device must have").

## Layout

| Component | What it does |
|---|---|
| `<Screen theme?>` | The whole game area. Wrap the game in one. Sets the theme colors, legible type and comfortable targets for this device, and pads the content away from the edges the device covers (a notch). |
| `<Stack direction? gap? align? justify? wrap? grow?>` | Children in a column (default) or a `row`, evenly spaced. `justify="between"` spreads them; `grow` takes the space left. |
| `<Grid columns? gap?>` | Children in equal columns (default 2). On a compact screen (a phone) grids wider than 2 use half the columns. |
| `<Panel tone?>` | A raised box grouping related content. |
| `<Text size? tone? align?>` | Text at a legible size: `sm`, `md` (default), `lg`, `xl` (heading), `title` (main heading). `tone`: `muted`, `accent`, `positive`, `negative`. |

`gap` is `none`, `sm`, `md` (default) or `lg`. `theme` overrides any of `background`, `surface`, `text`, `muted`, `accent`, `onAccent`, `positive`, `negative` (CSS colors); a person who asks for high contrast gets a high-contrast theme instead.

Sizes: `u(n)` is `n` UI units as a CSS length, and 100 units are the viewport's short side (`u(50)` is half of it). Use it (or `vmin`, the same) for sizes and positions you set yourself. Never use pixel sizes for text: the SDK's text never shows smaller than 16 CSS pixels on the device.

## Controls

| Component | Action | Works with |
|---|---|---|
| `<Button onPress disabled? tone? selected? label?>` | activate | Click, tap, Enter, Space, assistive technology. When `onPress` returns a promise, the button shows it pending and ignores more presses. `label` names a button whose content is not text. |
| `<Choices label options value onChange disabled? columns? marks?>` | select one | Tap or click an option; arrow keys move between options. `value` and `onChange` use the option's index. `marks` colors options after a reveal: `{ [index]: 'correct' \| 'wrong' }`. |
| `<TextAnswer label onSubmit submitLabel? placeholder? maxLength? disabled?>` | text | Typing (physical or on-screen keyboard), sent with Enter or its button. The text stays when `onSubmit` answers `{ ok: false }`. |

A quiz answer is a `Choices` whose `onChange` sends the command:

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
      <Choices
        label="Your answer"
        options={question.options.map((text, i) =>
          reveal ? `${text} (${reveal.counts[i]})` : text,
        )}
        value={phase.mine?.option ?? null}
        onChange={(option) => answer({ option })}
        disabled={phase.name !== 'question'}
        marks={reveal ? { [reveal.correct]: 'correct' } : undefined}
      />
```

## Game state

| Component | What it shows |
|---|---|
| `<Countdown />` | The current phase's seconds left (`12s`), highlighted for the last five. Nothing when the phase has no deadline. |
| `<Scoreboard standings name?>` | Standings from `ranking`, this player highlighted. `name(player)` shows a player id as text. |
| `<AssetImage asset alt fallback? fit?>` | A declared image, or `fallback` while it loads or when nobody uploaded it (`assets.md`). |

<!-- example: fixtures/sdk-games/quiz/client/Game.tsx -->
```tsx
      <Screen>
        <Text size="title">Final ranking</Text>
        <Scoreboard standings={view.standings} name={name} />
      </Screen>
```

## Presentation

The game is drawn at its fixed logical size and the platform scales it to the screen. `usePresentation()` tells how it really shows:

- `scale`: CSS pixels on the device per logical pixel; `width`, `height`: its size on screen in CSS pixels; `pixelRatio`.
- `density`: `compact` (a phone), `regular` or `spacious` (a large screen).
- `pointer`: `coarse` (touch) or `fine` (a mouse).
- `safeArea`: `{ top, right, bottom, left }` covered by the device, in logical pixels (`Screen` already pads for it).
- `reducedMotion`, `highContrast`: the person's preferences. The SDK's components already follow them.

Use it to adapt beyond what the components do, for example fewer items per row when `density` is `compact`.

## What the device must have

When a version is published, the build reads the client to decide which devices can play it:

- The SDK's controls (`Button`, `Choices`, `TextAnswer`) and `<button>` count only as pressing: they also accept a keyboard, but never require one. Such a game plays on phones and computers.
- Your own keyboard listeners (`onKeyDown`, `addEventListener('keydown', …)`) make the game need a physical keyboard: it plays on computers only.
- Hover listeners (`onMouseEnter`, `mouseover`…) together with pressing also restrict it to computers.

Prefer the SDK's controls. Use keyboard listeners only when the game really needs held keys (`recipes/drift.md`).
