import { createDeletion, type Deletion } from '@playhoot/feature-account';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, Checkbox, Dialog, PageHeading, Stage } from '../../ui';
import { useLayout } from '../layout';
import { profilePaths } from '../paths';
import styles from './Account.module.css';

// `/profile/delete`: ending one's own identity (P02§10-11, D-036). What it means is said before
// anything is confirmed; a guest is reminded first that upgrading keeps their name and games
// (P02§15), and the screen never claims the erasure already finished — only that it is underway.
export function DeleteRoute() {
  const intl = useIntl();
  const auth = useAuth();
  const { app, me } = useServices();
  const [feature] = useState(() => createDeletion({ app, me }));
  const state = useStore(feature.store);

  // While the deletion runs the screen says only that, and the person is taken home as it
  // finishes: the identity ends with it, and everything built for them is rebuilt at once.
  if (state.status === 'deleting' || state.status === 'deleted') {
    return (
      <Stage>
        <p className={styles.muted} role="status">
          {intl.formatMessage({ id: 'delete.working' })}
        </p>
      </Stage>
    );
  }
  // Nobody is signed in: this screen offers the way in rather than sending the person to it.
  // Being sent would be wrong the moment it matters most — a deletion ends the identity, and a
  // redirect would land on the sign-in screen instead of where the person was taken (D-043).
  if (auth.status === 'none') return <NothingToDelete />;
  if (auth.status === 'unknown') return null;
  return <DeleteIdentity feature={feature} />;
}

// What this screen is for someone with no identity to end.
function NothingToDelete() {
  const intl = useIntl();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  const location = useLocation();
  return (
    <Stage>
      <div className={styles.page}>
        <PageHeading
          title={intl.formatMessage({ id: 'delete.title' })}
          lead={intl.formatMessage({ id: 'delete.lead' })}
        />
        <Card>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <FormattedMessage id="profile.anonymous.title" />
            </h2>
            <p className={styles.muted}>
              <FormattedMessage id="delete.signedOut" />
            </p>
            <div className={styles.actions}>
              <Button onClick={() => void navigate(paths.auth({ next: location.pathname }))}>
                <FormattedMessage id="profile.anonymous.signIn" />
              </Button>
            </div>
          </section>
        </Card>
      </div>
    </Stage>
  );
}

function DeleteIdentity({ feature }: { feature: Deletion }) {
  const intl = useIntl();
  const auth = useAuth();
  const layout = useLayout();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  const state = useStore(feature.store);
  const [understood, setUnderstood] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const guest = auth.status === 'guest';

  return (
    <Stage wide={layout === 'wide'}>
      <div className={styles.page}>
        <PageHeading
          title={intl.formatMessage({ id: 'delete.title' })}
          lead={intl.formatMessage({ id: 'delete.lead' })}
        />
        {/* The way out comes before the way through: a guest keeps everything by upgrading. */}
        {guest && (
          <Card tone="highlight">
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FormattedMessage id="delete.upgrade.title" />
              </h2>
              <p className={styles.muted}>
                <FormattedMessage id="delete.upgrade.body" />
              </p>
              <div className={styles.actions}>
                <Button
                  onClick={() =>
                    void navigate(paths.auth({ account: true, next: profilePaths.home }))
                  }
                >
                  <FormattedMessage id="delete.upgrade.action" />
                </Button>
              </div>
            </section>
          </Card>
        )}
        <Card>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <FormattedMessage id="delete.what.title" />
            </h2>
            <ul className={styles.points}>
              <li className={styles.point}>
                <span className={styles.pointTitle}>
                  <FormattedMessage id="delete.what.accessTitle" />
                </span>
                <span className={styles.muted}>
                  <FormattedMessage id="delete.what.accessBody" />
                </span>
              </li>
              <li className={styles.point}>
                <span className={styles.pointTitle}>
                  <FormattedMessage id="delete.what.gamesTitle" />
                </span>
                <span className={styles.muted}>
                  <FormattedMessage id="delete.what.gamesBody" />
                </span>
              </li>
              <li className={styles.point}>
                <span className={styles.pointTitle}>
                  <FormattedMessage id="delete.what.clockTitle" />
                </span>
                <span className={styles.muted}>
                  <FormattedMessage id="delete.what.clockBody" />
                </span>
              </li>
              <li className={styles.point}>
                <span className={styles.pointTitle}>
                  <FormattedMessage id="delete.what.sharedTitle" />
                </span>
                <span className={styles.muted}>
                  <FormattedMessage id="delete.what.sharedBody" />
                </span>
              </li>
            </ul>
            <Checkbox
              label={<FormattedMessage id="delete.understand" />}
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
            {state.status === 'failed' && (
              <p className={styles.danger} role="alert">
                <FormattedMessage id="delete.failed" />
              </p>
            )}
            <div className={styles.actions}>
              <Button
                variant="danger"
                disabled={!understood || state.status === 'deleting'}
                onClick={() => setConfirming(true)}
              >
                <FormattedMessage id="delete.action" />
              </Button>
              <Button variant="ghost" onClick={() => void navigate(profilePaths.home)}>
                <FormattedMessage id="common.cancel" />
              </Button>
            </div>
          </section>
        </Card>
      </div>
      <Dialog
        open={confirming}
        title={intl.formatMessage({ id: 'delete.confirm.title' })}
        closeLabel={intl.formatMessage({ id: 'common.close' })}
        onClose={() => setConfirming(false)}
        actions={
          <>
            {/* Cancel is the default action: the dialog opens on the way back out. */}
            <Button variant="ghost" autoFocus onClick={() => setConfirming(false)}>
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button
              variant="danger"
              loading={state.status === 'deleting'}
              onClick={() => {
                setConfirming(false);
                // The person is taken home before the credential goes: every page is rebuilt
                // for whoever is signed in the moment that changes, this screen included.
                void feature.submit(() => navigate(paths.home, { replace: true }));
              }}
            >
              <FormattedMessage id="delete.confirm.action" />
            </Button>
          </>
        }
      >
        <p className={styles.muted}>
          <FormattedMessage id="delete.confirm.body" />
        </p>
      </Dialog>
    </Stage>
  );
}
