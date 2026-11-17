import type {
  LinkEmailError,
  MethodsError,
  MyDataError,
  RemoveMethodError,
  RenameError,
  SettingError,
} from '@playhoot/feature-account';
import type { IntlShape } from 'react-intl';

// Every refusal of the account screens, in the reader's language. The feature state answers
// kinds; the words are here, and the backend's own message is never shown.

export function myDataErrorText(intl: IntlShape, error: MyDataError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return intl.formatMessage({ id: 'profile.error.signedOut' });
    case 'rate-limited':
      return intl.formatMessage({ id: 'profile.error.busy' });
    case 'unavailable':
      return intl.formatMessage({ id: 'profile.error.unavailable' });
  }
}

export function renameErrorText(intl: IntlShape, error: RenameError): string {
  switch (error.kind) {
    case 'invalid':
      return intl.formatMessage({ id: 'profile.name.error.invalid' }, { max: error.maxLength });
    case 'limit-reached':
      return error.nextChangeAt
        ? intl.formatMessage(
            { id: 'profile.name.error.limitUntil' },
            { date: intl.formatDate(error.nextChangeAt, { dateStyle: 'medium' }) },
          )
        : intl.formatMessage({ id: 'profile.name.error.limit' });
    case 'rate-limited':
      return intl.formatMessage({ id: 'profile.error.busy' });
    case 'unavailable':
      return intl.formatMessage({ id: 'profile.error.unavailable' });
  }
}

export function settingErrorText(intl: IntlShape, error: SettingError): string {
  return error.kind === 'not-account'
    ? intl.formatMessage({ id: 'profile.error.notAccount' })
    : intl.formatMessage({ id: 'profile.error.unavailable' });
}

export function methodsErrorText(intl: IntlShape, error: MethodsError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return intl.formatMessage({ id: 'profile.error.signedOut' });
    case 'rate-limited':
      return intl.formatMessage({ id: 'profile.error.busy' });
    case 'unavailable':
      return intl.formatMessage({ id: 'methods.error.unavailable' });
  }
}

export function linkEmailErrorText(intl: IntlShape, error: LinkEmailError): string {
  switch (error.kind) {
    case 'invalid-address':
      return intl.formatMessage({ id: 'methods.email.error.address' });
    case 'wrong-code':
      return intl.formatMessage({ id: 'methods.email.error.code' });
    case 'attempt-gone':
      return intl.formatMessage({ id: 'methods.email.error.gone' });
    case 'in-use':
      return intl.formatMessage({ id: 'methods.error.inUse' });
    case 'rate-limited':
      return intl.formatMessage({ id: 'profile.error.busy' });
    case 'unavailable':
      return intl.formatMessage({ id: 'methods.error.unavailable' });
  }
}

export function removeMethodErrorText(intl: IntlShape, error: RemoveMethodError): string {
  switch (error.kind) {
    case 'last-method':
      return intl.formatMessage({ id: 'methods.error.lastMethod' });
    case 'unknown':
      return intl.formatMessage({ id: 'methods.error.unknown' });
    case 'unavailable':
      return intl.formatMessage({ id: 'methods.error.unavailable' });
  }
}
