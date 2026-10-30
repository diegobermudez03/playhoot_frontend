import type { AccountSignInError } from '@playhoot/feature-sign-in';
import type { IntlShape } from 'react-intl';

export function accountSignInErrorText(intl: IntlShape, error: AccountSignInError): string {
  switch (error.kind) {
    case 'cancelled':
      return intl.formatMessage({ id: 'signIn.error.cancelled' });
    case 'provider-unavailable':
      return intl.formatMessage({ id: 'signIn.error.providerUnavailable' });
    case 'rate-limited':
      return intl.formatMessage(
        { id: 'identity.error.rateLimited' },
        { seconds: error.retryAfterSeconds ?? 0 },
      );
    case 'unavailable':
      return intl.formatMessage({ id: 'identity.error.unavailable' });
    case 'failed':
      return intl.formatMessage({ id: 'signIn.error.failed' });
  }
}
