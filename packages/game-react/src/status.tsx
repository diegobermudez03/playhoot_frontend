// Ready-made pieces for the state every game shows: the phase's countdown, the scoreboard and a
// declared image with its fallback.
import type { Standing } from '@playhoot/game-core';
import type { ReactNode } from 'react';

import { usePhase, usePlayer, useAsset, type AssetRef } from './index';
import { Text } from './presentation';
import { useSdkText } from './texts';

// The current phase's seconds left ("12s"), highlighted for the last five; nothing without a
// deadline. The server sends them once a second.
export function Countdown() {
  const phase = usePhase();
  const sdkText = useSdkText();
  const left = phase?.secondsLeft;
  if (left === null || left === undefined) return null;
  return (
    <Text size="lg" tone={left <= 5 ? 'negative' : 'muted'} align="end">
      <span role="timer" aria-live="off" aria-label={sdkText('secondsLeft', { seconds: left })}>
        {left}s
      </span>
    </Text>
  );
}

// The standings (from `ranking`), this player highlighted. `name` shows a player id as text.
export function Scoreboard({
  standings,
  name = (player) => player,
}: {
  standings: readonly Standing[];
  name?(player: string): ReactNode;
}) {
  const { id } = usePlayer();
  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 'calc(var(--ph-gap) / 2)',
      }}
    >
      {standings.map((standing) => (
        <li
          key={standing.player}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--ph-gap)',
            padding: 'calc(var(--ph-gap) / 2) var(--ph-gap)',
            borderRadius: 'var(--ph-radius)',
            background: standing.player === id ? 'var(--ph-accent)' : 'var(--ph-surface)',
            color: standing.player === id ? 'var(--ph-on-accent)' : 'var(--ph-color)',
          }}
        >
          <span>
            #{standing.rank} {name(standing.player)}
          </span>
          <span>{standing.points}</span>
        </li>
      ))}
    </ol>
  );
}

// A declared image asset, or `fallback` while it loads or when this version has no file for it.
export function AssetImage({
  asset,
  alt,
  fallback = null,
  fit = 'contain',
}: {
  asset: AssetRef;
  alt: string;
  fallback?: ReactNode;
  fit?: 'contain' | 'cover';
}) {
  const state = useAsset(asset);
  if (state.status !== 'ready') return <>{fallback}</>;
  return (
    <img
      src={state.url}
      alt={alt}
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: fit }}
    />
  );
}
