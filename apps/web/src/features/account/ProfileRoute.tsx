import { supportedLocales, type Locale } from '@playhoot/app-core';
import { createMyData, displayNameAllowance, type MyDataFeature } from '@playhoot/feature-account';
import { useEffect, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useLocation, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import type { MessageId } from '../../i18n/catalogs';
import { languageNames } from '../../i18n/catalogs';
import { useLocale } from '../../i18n/LocaleContext';
import { segmentOfLocale } from '../../i18n/localePaths';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, ModeSwitch, PageHeading, Select, Stage, TextField } from '../../ui';
import { useLayout } from '../layout';
import { notificationPaths, profilePaths, teacherPath } from '../paths';
import styles from './Account.module.css';
import { myDataErrorText, renameErrorText, settingErrorText } from './accountErrors';

// `/profile`: the person's own corner. It works without any identity (SPEC_MAP §19) — it then
// explains what an account gives and offers the way in — and for a guest it says plainly that a
// guest goes away after 90 days without use (P02§9), with the upgrade offer beside it.
export function ProfileRoute() {
  const auth = useAuth();
  const { app, me, identity } = useServices();
  const [feature] = useState(() => createMyData({ app, me, identity }));
  const signedIn = auth.status === 'guest' || auth.status === 'authenticated';

  useEffect(() => {
    if (signedIn) void feature.load();
  }, [feature, signedIn]);

  // Who the person is decides the whole screen: nothing is drawn before it is known.
  if (auth.status === 'unknown') return null;
  return <Profile feature={feature} />;
}

function Profile({ feature }: { feature: MyDataFeature }) {
  const intl = useIntl();
  const auth = useAuth();
  const layout = useLayout();
  const state = useStore(feature.store);
  const signedOut = auth.status === 'none';

  return (
    <Stage wide={layout === 'wide'}>
      <div className={styles.page}>
        <PageHeading
          title={intl.formatMessage({ id: 'profile.title' })}
          lead={intl.formatMessage({ id: 'profile.lead' })}
        />
        {state.status === 'failed' && state.error && (
          <p className={styles.danger} role="alert">
            {myDataErrorText(intl, state.error)}
          </p>
        )}
        {/* Compact: one column, every section whole. Wide: two columns, nothing split in half. */}
        <div className={layout === 'wide' ? styles.columns : styles.page}>
          {signedOut ? (
            <SignedOutSection />
          ) : (
            <>
              <IdentitySection feature={feature} />
              <SettingsSection feature={feature} />
              <DoorsSection />
              <LeaveSection />
            </>
          )}
        </div>
      </div>
    </Stage>
  );
}

// Without an identity: what an account gives, and the way in (SPEC_MAP §19).
function SignedOutSection() {
  const paths = useLocalePaths();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="profile.anonymous.title" />
        </h2>
        <p className={styles.muted}>
          <FormattedMessage id="profile.anonymous.body" />
        </p>
        <div className={styles.actions}>
          <Button onClick={() => void navigate(paths.auth({ next: location.pathname }))}>
            <FormattedMessage id="profile.anonymous.signIn" />
          </Button>
        </div>
      </section>
    </Card>
  );
}

// Who the person is, and the name everyone else sees for them.
function IdentitySection({ feature }: { feature: MyDataFeature }) {
  const intl = useIntl();
  const auth = useAuth();
  const paths = useLocalePaths();
  const navigate = useNavigate();
  const state = useStore(feature.store);
  const known =
    auth.status === 'guest' || auth.status === 'authenticated' ? auth.displayName : null;
  const current = state.data?.profile.displayName || known || '';
  const guest = auth.status === 'guest';
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void feature.rename(name).then((done) => {
      if (done) setEditing(false);
    });
  };

  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="profile.identity.title" />
        </h2>
        <div className={styles.who}>
          <p className={styles.name}>{current || intl.formatMessage({ id: 'account.unnamed' })}</p>
        </div>
        <p className={styles.subtle}>
          <FormattedMessage id={guest ? 'profile.identity.guest' : 'profile.identity.account'} />
        </p>
        {editing ? (
          <form className={styles.form} onSubmit={submit} noValidate>
            <TextField
              label={intl.formatMessage({ id: 'profile.name.label' })}
              value={name}
              autoFocus
              maxLength={displayNameAllowance.maxLength}
              onChange={(event) => setName(event.target.value)}
              hint={intl.formatMessage(
                { id: 'profile.name.allowance' },
                { changes: displayNameAllowance.changes, days: displayNameAllowance.windowDays },
              )}
              error={state.renameError ? renameErrorText(intl, state.renameError) : null}
            />
            <div className={styles.actions}>
              <Button type="submit" loading={state.saving === 'name'}>
                <FormattedMessage id="profile.name.save" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  feature.dismiss();
                }}
              >
                <FormattedMessage id="common.cancel" />
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.stack}>
            <p className={styles.subtle}>
              <FormattedMessage
                id="profile.name.allowance"
                values={{
                  changes: displayNameAllowance.changes,
                  days: displayNameAllowance.windowDays,
                }}
              />
            </p>
            {state.renamed && (
              <p className={styles.subtle} role="status">
                <FormattedMessage id="profile.name.saved" />
              </p>
            )}
            {state.renameError && (
              <p className={styles.danger} role="alert">
                {renameErrorText(intl, state.renameError)}
              </p>
            )}
            <div className={styles.actions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setName(current);
                  feature.dismiss();
                  setEditing(true);
                }}
              >
                <FormattedMessage id="profile.name.change" />
              </Button>
            </div>
          </div>
        )}
        {guest && (
          <div className={styles.stack}>
            <p className={styles.muted}>
              <FormattedMessage id="identity.guestExpiry" />
            </p>
            <p className={styles.subtle}>
              <FormattedMessage id="profile.guest.upgrade" />
            </p>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                onClick={() =>
                  void navigate(paths.auth({ account: true, next: profilePaths.home }))
                }
              >
                <FormattedMessage id="profile.guest.createAccount" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </Card>
  );
}

// The two settings an account decides: the mode it is in and the language it reads Playhoot in.
// A guest sees the language alone, and theirs lives in this browser.
function SettingsSection({ feature }: { feature: MyDataFeature }) {
  const intl = useIntl();
  const auth = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale } = useLocale();
  const state = useStore(feature.store);
  const account = auth.status === 'authenticated';
  const mode = account && auth.mode === 'teacher' ? 'teacher' : 'normal';

  const chooseLanguage = (next: Locale) => {
    // The page follows at once; the account is told so that its emails follow too.
    setLocale(next);
    if (account) void feature.setLanguage(segmentOfLocale(next));
  };

  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="profile.settings.title" />
        </h2>
        <Select
          label={intl.formatMessage({ id: 'language.label' })}
          value={locale}
          onChange={(event) => chooseLanguage(event.target.value as Locale)}
          hint={intl.formatMessage({
            id: account ? 'profile.language.account' : 'profile.language.guest',
          })}
        >
          {supportedLocales.map((option) => (
            <option key={option} value={option} lang={option}>
              {languageNames[option]}
            </option>
          ))}
        </Select>
        {account && (
          <div className={styles.stack}>
            <ModeSwitch
              label={intl.formatMessage({ id: 'mode.label' })}
              value={mode}
              onChange={(next: 'normal' | 'teacher') => {
                if (next === mode) return;
                void feature.setMode(next).then((done) => {
                  if (done && next === 'teacher') void navigate(teacherPath);
                });
              }}
              options={[
                { value: 'normal', label: intl.formatMessage({ id: 'mode.normal' }) },
                { value: 'teacher', label: intl.formatMessage({ id: 'mode.teacher' }) },
              ]}
            />
            <p className={styles.subtle}>
              <FormattedMessage id="profile.mode.hint" />
            </p>
          </div>
        )}
        {state.settingError && (
          <p className={styles.danger} role="alert">
            {settingErrorText(intl, state.settingError)}
          </p>
        )}
      </section>
    </Card>
  );
}

// The doors behind the profile, in the order they are offered. Some belong to an account alone.
const doors: readonly { to: string; label: MessageId; note: MessageId; accountOnly?: true }[] = [
  {
    to: profilePaths.methods,
    label: 'profile.doors.methods',
    note: 'profile.doors.methodsNote',
    accountOnly: true,
  },
  { to: profilePaths.legal, label: 'profile.doors.legal', note: 'profile.doors.legalNote' },
  {
    to: notificationPaths.preferences,
    label: 'profile.doors.preferences',
    note: 'profile.doors.preferencesNote',
    accountOnly: true,
  },
  {
    to: notificationPaths.history,
    label: 'profile.doors.notifications',
    note: 'profile.doors.notificationsNote',
  },
  { to: profilePaths.delete, label: 'profile.doors.delete', note: 'profile.doors.deleteNote' },
];

// The doors to the subscreens, and what is named but is not here yet.
function DoorsSection() {
  const auth = useAuth();
  const account = auth.status === 'authenticated';
  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="profile.doors.title" />
        </h2>
        <ul className={styles.links}>
          {doors
            .filter((door) => account || !door.accountOnly)
            .map((door) => (
              <li key={door.to}>
                <Door to={door.to} label={door.label} note={door.note} />
              </li>
            ))}
        </ul>
        {/* Named with the milestone that brings them, inventing nothing. */}
        <p className={styles.later}>
          <FormattedMessage id="profile.later.purchases" />
        </p>
        <p className={styles.later}>
          <FormattedMessage id="profile.later.history" />
        </p>
      </section>
    </Card>
  );
}

function Door({ to, label, note }: { to: string; label: MessageId; note: MessageId }) {
  return (
    <Link className={styles.link} to={to}>
      <span className={styles.linkText}>
        <FormattedMessage id={label} />
        <span className={styles.linkNote}>
          <FormattedMessage id={note} />
        </span>
      </span>
    </Link>
  );
}

// Signing out is here as well as in the shell menu.
function LeaveSection() {
  const { app } = useServices();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="profile.leave.title" />
        </h2>
        <p className={styles.muted}>
          <FormattedMessage id="profile.leave.body" />
        </p>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => {
              app.signOut();
              void navigate(paths.home);
            }}
          >
            <FormattedMessage id="account.signOut" />
          </Button>
        </div>
      </section>
    </Card>
  );
}
