import { encodeQr } from '@playhoot/feature-admin';
import { useMemo } from 'react';

import styles from './Admin.module.css';

// The enrollment URI as a QR, drawn here from the modules: the secret is never sent anywhere to
// be turned into a picture (D-015 — it is shown once, to one person).
export function QrCode({ value, label }: { value: string; label: string }) {
  const matrix = useMemo(() => encodeQr(value), [value]);
  if (!matrix) return null;
  // Four light modules all round, which is what a scanner needs to find the symbol.
  const quiet = 4;
  const side = matrix.size + quiet * 2;
  const path = matrix.modules
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${x + quiet} ${y + quiet}h1v1h-1z` : '')).filter(Boolean),
    )
    .join('');
  return (
    <svg
      className={styles.qr}
      viewBox={`0 0 ${side} ${side}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={side} height={side} fill="var(--color-surface-raised)" />
      <path d={path} fill="var(--color-text)" />
    </svg>
  );
}
