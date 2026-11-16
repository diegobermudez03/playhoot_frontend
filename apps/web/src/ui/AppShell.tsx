import type { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router';

import { ShellBar } from '../app/shell/ShellBar';
import { useShell } from '../app/shell/ShellContext';
import { isAdminPath, isBarePublicPath } from '../features/paths';
import styles from './AppShell.module.css';

// The frame every non-admin screen renders inside: the fixed top bar and the page under it. It is
// rendered once above the router (root.tsx), so a navigation changes what is inside `main` and
// never rebuilds the bar — the unread count, an open menu and the scroll position of the bar
// survive it. A screen says how it wants to be framed with `useShellMode`.
export function AppShell({ children }: { children: ReactNode }) {
  const intl = useIntl();
  const { pathname } = useLocation();
  const { mode: asked } = useShell();
  // The admin area frames itself (D-023), and it is known from the address alone, so its pages
  // never show this bar even for the render before they could ask not to.
  const mode = isAdminPath(pathname) ? 'plain' : isBarePublicPath(pathname) ? 'bare' : asked;
  if (mode === 'plain') return <>{children}</>;
  if (mode === 'immersive') {
    return (
      <div className={styles.shell}>
        <main id={mainId} className={`${styles.main} ${styles.immersive}`}>
          {children}
        </main>
      </div>
    );
  }
  return (
    <div className={styles.shell}>
      {/* WCAG 2.2 2.4.1: the first thing the keyboard reaches is the way past the bar. */}
      <a className={styles.skip} href={`#${mainId}`}>
        {intl.formatMessage({ id: 'shell.skipToContent' })}
      </a>
      <ShellBar bare={mode === 'bare'} />
      <main id={mainId} className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

const mainId = 'main';

// A centered column for focused, single-task screens.
export function Stage({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={[styles.stage, wide && styles.wide, 'motion-cascade'].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

// The wide variant of a focused screen: `aside` (the greeting: mascot, title) beside the task,
// both centered, so nothing has to scroll on a short landscape display.
export function SplitStage({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className={`${styles.split} motion-cascade`}>
      <div className={styles.splitAside}>{aside}</div>
      <div className={styles.splitMain}>{children}</div>
    </div>
  );
}
