import type { IdentityError } from '@playhoot/feature-sign-in';
import type { IntlShape } from 'react-intl';

// Why a display name was not accepted. Kinds in, text out: the backend's own message is never
// shown (user-facing-text.md).
export function identityErrorText(intl: IntlShape, error: IdentityError): string {
  switch (error.kind) {
    case 'invalid-name':
      return error.reason === 'empty'
        ? intl.formatMessage({ id: 'identity.error.empty' })
        : error.reason === 'too-long'
          ? intl.formatMessage({ id: 'identity.error.tooLong' }, { max: error.maxLength })
          : intl.formatMessage({ id: 'identity.error.rejected' });
    case 'rate-limited':
      return intl.formatMessage(
        { id: 'identity.error.rateLimited' },
        { seconds: error.retryAfterSeconds ?? 0 },
      );
    case 'unavailable':
      return intl.formatMessage({ id: 'identity.error.unavailable' });
  }
}
