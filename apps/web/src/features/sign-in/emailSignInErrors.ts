import type { EmailSignInError } from '@playhoot/feature-sign-in';
import type { IntlShape } from 'react-intl';

// What a person reads when a code by email did not work. The wording never says anything about
// the address itself: whether it has an account is not ours to tell (D-033).
export function emailSignInErrorText(intl: IntlShape, error: EmailSignInError): string {
  switch (error.kind) {
    case 'invalid-address':
      return intl.formatMessage({ id: 'emailCode.error.invalidAddress' });
    case 'wrong-code':
      return intl.formatMessage({ id: 'emailCode.error.wrongCode' });
    case 'attempt-gone':
      return intl.formatMessage({ id: 'emailCode.error.attemptGone' });
    case 'rate-limited':
      return error.retryAfterSeconds === undefined
        ? intl.formatMessage({ id: 'emailCode.error.rateLimited' })
        : intl.formatMessage(
            { id: 'emailCode.error.rateLimitedIn' },
            { seconds: error.retryAfterSeconds },
          );
    case 'unavailable':
      return intl.formatMessage({ id: 'emailCode.error.unavailable' });
  }
}
