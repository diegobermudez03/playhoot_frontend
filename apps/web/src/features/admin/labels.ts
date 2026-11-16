import {
  budgetLadderLevels,
  emailDeliveryStates,
  emailModes,
  budgetWindows,
} from '@playhoot/protocol';
import type { IntlShape } from 'react-intl';

import type { StatusTone, TagTone } from '../../ui';

// Backend values are never a closed list (AGENTS.md): a value this build knows is translated, and
// one it does not is shown exactly as the backend wrote it rather than guessed at or hidden.
function known<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

export function ladderLevelText(intl: IntlShape, level: string): string {
  return known(budgetLadderLevels, level)
    ? intl.formatMessage({ id: `admin.budget.level.${level}` })
    : level;
}

// The tone is never the only sign of a level: the text beside it always names it (WCAG 1.4.1).
export function ladderTone(level: string): StatusTone {
  switch (level) {
    case 'normal':
      return 'success';
    case 'restricted':
      return 'warning';
    case 'paused':
    case 'shutdown':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function windowText(intl: IntlShape, window: string): string {
  return known(budgetWindows, window)
    ? intl.formatMessage({ id: `admin.budget.window.${window}` })
    : window;
}

export function emailModeText(intl: IntlShape, mode: string): string {
  return known(emailModes, mode) ? intl.formatMessage({ id: `admin.email.mode.${mode}` }) : mode;
}

export function deliveryStateText(intl: IntlShape, state: string): string {
  return known(emailDeliveryStates, state)
    ? intl.formatMessage({ id: `admin.email.state.${state}` })
    : state;
}

export function deliveryTone(state: string): TagTone {
  switch (state) {
    case 'sent':
      return 'success';
    case 'pending':
      return 'info';
    case 'rejected':
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}
