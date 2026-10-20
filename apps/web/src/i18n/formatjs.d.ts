import type { MessageId } from './messages/en';

// Makes every formatMessage/FormattedMessage id type-checked against the source catalog.
declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId;
    }
  }
}
