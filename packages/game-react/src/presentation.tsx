// How the game is shown (the bridge's presentation context) and the layout primitives built on it.
// Everything is sized in the game's logical pixels: 1 `u` is 1/100 of the viewport's short side,
// and text and touch targets never get smaller on screen than a legible, comfortable size.
import type { Presentation } from '@playhoot/game-sdk';
import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';

import { useRuntime } from './runtime';

export type { Presentation, PresentationDensity } from '@playhoot/game-sdk';

// Before the Host says (or with a Host speaking bridge v1), the game is assumed shown at full size.
const shownAtFullSize: Presentation = {
  scale: 1,
  width: 0,
  height: 0,
  pixelRatio: 1,
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  density: 'regular',
  pointer: 'fine',
  reducedMotion: false,
  highContrast: false,
};

// How the game is shown on this device: size on screen, density (compact on a phone), the pointer
// (coarse for touch), the edges the device covers and the person's preferences.
export function usePresentation(): Presentation {
  const { presentation } = useRuntime();
  return useSyncExternalStore(presentation.subscribe, presentation.get) ?? shownAtFullSize;
}

// `n` UI units as a CSS length: 100 units are the viewport's short side (`u(50)` is half of it).
export function u(n: number): string {
  return `${n}vmin`;
}

export interface Theme {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  // Text on the accent color.
  onAccent: string;
  positive: string;
  negative: string;
}

export const defaultTheme: Theme = {
  background: '#1d1b4b',
  surface: '#2e2a6b',
  text: '#ffffff',
  muted: '#c7c3f0',
  accent: '#fcd34d',
  onAccent: '#1d1b4b',
  positive: '#34d399',
  negative: '#f87171',
};

const highContrastTheme: Theme = {
  background: '#000000',
  surface: '#1a1a1a',
  text: '#ffffff',
  muted: '#ffffff',
  accent: '#ffe600',
  onAccent: '#000000',
  positive: '#00ff90',
  negative: '#ff5c5c',
};

// The whole game area: theme colors, legible type and comfortable targets for this device, and
// padding that keeps content out of the edges the device covers. Wrap the game in one.
export function Screen({
  children,
  theme,
  style,
}: {
  children: ReactNode;
  theme?: Partial<Theme>;
  style?: CSSProperties;
}) {
  const presentation = usePresentation();
  const colors = { ...(presentation.highContrast ? highContrastTheme : defaultTheme), ...theme };
  // Logical pixels that show as `css` CSS pixels on this screen.
  const shown = (css: number) => `${Math.round(css / (presentation.scale || 1))}px`;
  const { safeArea } = presentation;
  const pad = (edge: number) => `calc(var(--ph-gap) * 2 + ${edge}px)`;
  const tokens = {
    '--ph-text': `max(3.2vmin, ${shown(16)})`,
    '--ph-target': `max(9vmin, ${shown(44)})`,
    '--ph-gap': `max(2vmin, ${shown(8)})`,
    '--ph-radius': '2vmin',
    '--ph-background': colors.background,
    '--ph-surface': colors.surface,
    '--ph-color': colors.text,
    '--ph-muted': colors.muted,
    '--ph-accent': colors.accent,
    '--ph-on-accent': colors.onAccent,
    '--ph-positive': colors.positive,
    '--ph-negative': colors.negative,
    '--ph-transition': presentation.reducedMotion ? '0s' : '120ms',
  } as CSSProperties;
  return (
    <div
      data-density={presentation.density}
      style={{
        ...tokens,
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ph-gap)',
        padding: `${pad(safeArea.top)} ${pad(safeArea.right)} ${pad(safeArea.bottom)} ${pad(safeArea.left)}`,
        background: 'var(--ph-background)',
        color: 'var(--ph-color)',
        font: '600 var(--ph-text)/1.3 system-ui, sans-serif',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type Gap = 'none' | 'sm' | 'md' | 'lg';
const gaps: Record<Gap, string> = {
  none: '0',
  sm: 'calc(var(--ph-gap) / 2)',
  md: 'var(--ph-gap)',
  lg: 'calc(var(--ph-gap) * 2)',
};
const placements = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  between: 'space-between',
} as const;

// Children in a column (or a `row`), spaced evenly. `grow` makes it take the space left.
export function Stack({
  children,
  direction = 'column',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  grow = false,
  style,
}: {
  children: ReactNode;
  direction?: 'column' | 'row';
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
  grow?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: gaps[gap],
        alignItems: placements[align],
        justifyContent: placements[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...(grow && { flex: 1, minHeight: 0 }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Children in equal columns. On a compact screen (a phone) wide grids use half the columns.
export function Grid({
  children,
  columns = 2,
  gap = 'md',
  style,
}: {
  children: ReactNode;
  columns?: number;
  gap?: Gap;
  style?: CSSProperties;
}) {
  const { density } = usePresentation();
  const shown = density === 'compact' && columns > 2 ? Math.ceil(columns / 2) : columns;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${shown}, minmax(0, 1fr))`,
        gap: gaps[gap],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type Tone = 'surface' | 'accent' | 'positive' | 'negative';
const toneColors: Record<Tone, { background: string; color: string }> = {
  surface: { background: 'var(--ph-surface)', color: 'var(--ph-color)' },
  accent: { background: 'var(--ph-accent)', color: 'var(--ph-on-accent)' },
  positive: { background: 'var(--ph-positive)', color: 'var(--ph-on-accent)' },
  negative: { background: 'var(--ph-negative)', color: 'var(--ph-on-accent)' },
};

export function toneStyle(tone: Tone): CSSProperties {
  return toneColors[tone];
}

// A raised box grouping related content.
export function Panel({
  children,
  tone = 'surface',
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        ...toneColors[tone],
        borderRadius: 'var(--ph-radius)',
        padding: 'calc(var(--ph-gap) * 1.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ph-gap)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const textSizes = { sm: 0.8, md: 1, lg: 1.4, xl: 2, title: 2.6 } as const;

// Text at a legible size for this screen. `title` and `xl` are headings.
export function Text({
  children,
  size = 'md',
  tone,
  align,
  style,
}: {
  children: ReactNode;
  size?: keyof typeof textSizes;
  tone?: 'muted' | 'accent' | 'positive' | 'negative';
  align?: 'start' | 'center' | 'end';
  style?: CSSProperties;
}) {
  const Tag = size === 'title' ? 'h1' : size === 'xl' ? 'h2' : 'p';
  return (
    <Tag
      style={{
        margin: 0,
        fontSize: `calc(var(--ph-text) * ${textSizes[size]})`,
        fontWeight: size === 'title' || size === 'xl' ? 800 : 600,
        ...(tone && { color: `var(--ph-${tone})` }),
        ...(align && { textAlign: align }),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
