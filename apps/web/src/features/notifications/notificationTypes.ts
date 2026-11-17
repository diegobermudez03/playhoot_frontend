import type { NotificationEntry } from '@playhoot/communication';

import type { MessageId } from '../../i18n/catalogs';

// What each kind of event says, in the person's language. The backend's list of types is open: a
// type this build does not know is still shown, as a notification without a sentence of its own
// (T-204 rule), and the backend's own wording is never displayed.
const titles: Record<string, MessageId> = {
  welcome: 'notifications.type.welcome',
  'purchase-confirmed': 'notifications.type.purchaseConfirmed',
  'plan-changed': 'notifications.type.planChanged',
  'payment-failed': 'notifications.type.paymentFailed',
  'trial-update': 'notifications.type.trialUpdate',
  'account-security': 'notifications.type.accountSecurity',
  'guardian-authorization': 'notifications.type.guardianAuthorization',
  'ai-work-finished': 'notifications.type.aiWorkFinished',
  'capacity-warning': 'notifications.type.capacityWarning',
  'discovery-review': 'notifications.type.discoveryReview',
  'discovery-restriction': 'notifications.type.discoveryRestriction',
  'class-activity': 'notifications.type.classActivity',
  'budget-level-changed': 'notifications.type.budgetLevelChanged',
  marketing: 'notifications.type.marketing',
};

export function titleOf(entry: Pick<NotificationEntry, 'type'>): MessageId {
  return titles[entry.type] ?? 'notifications.type.unknown';
}

// The types this build can offer as a filter: the ones it has a sentence for. The backend may
// hold others, and "everything" is always an option, so nothing is hidden by this list.
export const filterableTypes = Object.keys(titles);
