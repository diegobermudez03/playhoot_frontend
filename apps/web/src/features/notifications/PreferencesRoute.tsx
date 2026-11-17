import { createPreferences } from '@playhoot/feature-notifications';
import { operations, optionalEmailGroups, type OptionalEmailGroup } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import type { MessageId } from '../../i18n/catalogs';
import { useLocale } from '../../i18n/LocaleContext';
import { segmentOfLocale } from '../../i18n/localePaths';
import { Button, Card, Dialog, PageHeading, Stage, Switch } from '../../ui';
import { RequireOperation } from '../access';
import { textName } from '../compliance/AcceptanceGate';
import { useLayout } from '../layout';
import { notificationPaths } from '../paths';
import styles from './Notifications.module.css';

// `/notifications/preferences`: the optional email groups and the marketing choice (P31§4).
// Marketing is apart because turning it on is an acceptance: the text is shown first and the
// record points at the exact version read; turning it off records the withdrawal (D-037).
// Necessary email says plainly that it cannot be turned off, and in-app notifications are never
// trimmed by any of this.
export function NotificationPreferencesRoute() {
  return (
    <RequireOperation operation={operations.setNotificationPreferences} reason="sign-in">
      <NotificationPreferences />
    </RequireOperation>
  );
}

const groupLabels: Record<OptionalEmailGroup, { label: MessageId; hint: MessageId }> = {
  ai: { label: 'preferences.ai', hint: 'preferences.aiHint' },
  capacity: { label: 'preferences.capacity', hint: 'preferences.capacityHint' },
  review: { label: 'preferences.review', hint: 'preferences.reviewHint' },
};

function NotificationPreferences() {
  const intl = useIntl();
  const layout = useLayout();
  const { locale } = useLocale();
  const { notificationsApi, compliance } = useServices();
  const [feature] = useState(() => createPreferences({ client: notificationsApi, compliance }));
  const state = useStore(feature.store);
  const language = segmentOfLocale(locale);
  // Open while the person reads the marketing text they are about to accept.
  const [readingMarketing, setReadingMarketing] = useState(false);

  useEffect(() => {
    void feature.load();
  }, [feature]);

  const askMarketing = () => {
    setReadingMarketing(true);
    void feature.readMarketingText(language);
  };

  const marketing = state.preferences?.marketing ?? false;

  return (
    <Stage wide={layout === 'wide'}>
      <div className={styles.page}>
        <PageHeading
          title={intl.formatMessage({ id: 'preferences.title' })}
          lead={intl.formatMessage({ id: 'preferences.lead' })}
          actions={
            <Link className={styles.preferencesLink} to={notificationPaths.history}>
              <FormattedMessage id="preferences.seeAll" />
            </Link>
          }
        />
        {state.status === 'failed' && (
          <p className={styles.danger} role="alert">
            <FormattedMessage id="preferences.unavailable" />
          </p>
        )}
        {state.saveFailed && (
          <p className={styles.danger} role="alert">
            <FormattedMessage id="preferences.saveFailed" />
          </p>
        )}
        <div className={layout === 'wide' ? styles.columns : styles.page}>
          <Card>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FormattedMessage id="preferences.optional.title" />
              </h2>
              {state.preferences === null ? (
                <p className={styles.muted}>
                  <FormattedMessage id="preferences.loading" />
                </p>
              ) : (
                <div className={styles.switches}>
                  {optionalEmailGroups.map((group) => (
                    <Switch
                      key={group}
                      label={<FormattedMessage id={groupLabels[group].label} />}
                      hint={<FormattedMessage id={groupLabels[group].hint} />}
                      checked={state.preferences?.[group] ?? false}
                      busy={state.saving === group}
                      onChange={(on) => void feature.setGroup(group, on)}
                    />
                  ))}
                </div>
              )}
              <p className={styles.subtle}>
                <FormattedMessage id="preferences.necessary" />
              </p>
              <p className={styles.subtle}>
                <FormattedMessage id="preferences.inApp" />
              </p>
            </section>
          </Card>
          <Card>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FormattedMessage id="preferences.marketing.title" />
              </h2>
              {state.preferences !== null && (
                <Switch
                  label={<FormattedMessage id="preferences.marketing.label" />}
                  hint={<FormattedMessage id="preferences.marketing.hint" />}
                  checked={marketing}
                  busy={state.saving === 'marketing'}
                  onChange={(on) => {
                    // Turning it on is an acceptance: the text comes first, and the record
                    // points at the version shown. Turning it off is a withdrawal, recorded
                    // without asking anything more.
                    if (on) askMarketing();
                    else void feature.setMarketing(false, language);
                  }}
                />
              )}
              {state.marketingTextMissing && (
                <p className={styles.subtle}>
                  <FormattedMessage id="texts.notPublished" />
                </p>
              )}
            </section>
          </Card>
        </div>
      </div>
      <Dialog
        open={readingMarketing}
        title={textName(intl, 'marketing')}
        closeLabel={intl.formatMessage({ id: 'acceptance.close' })}
        onClose={() => setReadingMarketing(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setReadingMarketing(false)}>
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button
              disabled={state.marketingText === null}
              loading={state.saving === 'marketing'}
              onClick={() => {
                setReadingMarketing(false);
                void feature.setMarketing(true, language);
              }}
            >
              <FormattedMessage id="preferences.marketing.accept" />
            </Button>
          </>
        }
      >
        {state.marketingText ? (
          <>
            <p className={styles.subtle}>
              <FormattedMessage
                id="acceptance.version"
                values={{ version: state.marketingText.version }}
              />
            </p>
            <p className={styles.textContent}>{state.marketingText.content}</p>
          </>
        ) : (
          <p className={styles.muted}>
            <FormattedMessage
              id={state.marketingTextMissing ? 'texts.notPublished' : 'texts.loading'}
            />
          </p>
        )}
      </Dialog>
    </Stage>
  );
}
