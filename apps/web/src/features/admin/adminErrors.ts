import type { AdminFailure } from '@playhoot/feature-admin';
import type { IntlShape } from 'react-intl';

// One line for each way something in the admin area can fail. The backend's own message is never
// shown: only the kind it answered with, translated here.
export function adminErrorText(intl: IntlShape, failure: AdminFailure): string {
  switch (failure.kind) {
    case 'locked':
      return failure.retryAfterSeconds === undefined
        ? intl.formatMessage({ id: 'admin.error.locked' })
        : intl.formatMessage(
            { id: 'admin.error.lockedFor' },
            { minutes: Math.max(1, Math.ceil(failure.retryAfterSeconds / 60)) },
          );
    case 'rate-limited':
      return intl.formatMessage({ id: 'admin.error.rateLimited' });
    case 'conflict':
      return intl.formatMessage({ id: 'admin.error.conflict' });
    default:
      return intl.formatMessage({ id: `admin.error.${failure.kind}` });
  }
}
