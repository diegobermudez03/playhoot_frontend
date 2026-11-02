import { buildStatuses } from '@playhoot/protocol';
import { FormattedMessage } from 'react-intl';

import styles from './GameWorkspace.module.css';

// A build's status as a small badge; `null` is a revision without a build.
export function BuildStatusBadge({ status }: { status: string | null }) {
  const tone =
    status === buildStatuses.succeeded
      ? styles.badgeOk
      : status === buildStatuses.failed
        ? styles.badgeError
        : status === buildStatuses.queued || status === buildStatuses.running
          ? styles.badgeBusy
          : styles.badgeNeutral;
  return (
    <span
      className={`${styles.badge} ${tone}`}
      data-testid="build-status"
      data-status={status ?? 'none'}
    >
      <FormattedMessage id="build.status" values={{ status: status ?? 'none' }} />
    </span>
  );
}
