import { createMyData } from '@playhoot/feature-account';
import { operations } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, Mascot, SplitStage, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout } from '../layout';
import { myGamesPath, newSessionPath } from '../paths';
import styles from './Account.module.css';
import { settingErrorText } from './accountErrors';

// `/teacher`: where teacher mode lands until H8 builds teaching (D-034). It says what teaching
// will be as what is coming, the way the home treats the catalog (D-029): no invented classes,
// no invented figures, and nothing offered for sale that cannot be bought yet.
export function TeacherRoute() {
  return (
    <RequireOperation operation={operations.setOwnMode} reason="sign-in">
      <Teacher />
    </RequireOperation>
  );
}

function Teacher() {
  const intl = useIntl();
  const auth = useAuth();
  const layout = useLayout();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  const { app, me, identity } = useServices();
  const [feature] = useState(() => createMyData({ app, me, identity }));
  const state = useStore(feature.store);
  const teaching = auth.status === 'authenticated' && auth.mode === 'teacher';

  // Reaching this address is asking for teacher mode: the switch and the shell both land here,
  // and so does a bookmark, so the mode is set from here too rather than only on the way in.
  useEffect(() => {
    if (auth.status === 'authenticated' && auth.mode !== 'teacher') void feature.setMode('teacher');
  }, [auth, feature]);

  const hero = (
    <div className={styles.hero}>
      <Mascot size={88} mood="happy" />
      <h1 className={styles.heroTitle}>{intl.formatMessage({ id: 'teacher.title' })}</h1>
      <p className={styles.muted}>
        <FormattedMessage id="teacher.lead" />
      </p>
    </div>
  );

  const panel = (
    <div className={styles.page}>
      <Card>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <FormattedMessage id="teacher.coming.title" />
          </h2>
          <ul className={styles.points}>
            <li className={styles.point}>
              <span className={styles.pointTitle}>
                <FormattedMessage id="teacher.coming.classesTitle" />
              </span>
              <span className={styles.muted}>
                <FormattedMessage id="teacher.coming.classesBody" />
              </span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointTitle}>
                <FormattedMessage id="teacher.coming.activitiesTitle" />
              </span>
              <span className={styles.muted}>
                <FormattedMessage id="teacher.coming.activitiesBody" />
              </span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointTitle}>
                <FormattedMessage id="teacher.coming.gradesTitle" />
              </span>
              <span className={styles.muted}>
                <FormattedMessage id="teacher.coming.gradesBody" />
              </span>
            </li>
          </ul>
          <p className={styles.later}>
            <FormattedMessage id="teacher.plans" />
          </p>
        </section>
      </Card>
      <Card>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <FormattedMessage id="teacher.meanwhile.title" />
          </h2>
          <p className={styles.muted}>
            <FormattedMessage id="teacher.meanwhile.body" />
          </p>
          <div className={styles.actions}>
            <Button onClick={() => void navigate(myGamesPath)}>
              <FormattedMessage id="teacher.meanwhile.games" />
            </Button>
            <Button variant="secondary" onClick={() => void navigate(newSessionPath)}>
              <FormattedMessage id="teacher.meanwhile.session" />
            </Button>
          </div>
        </section>
      </Card>
      <Card>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <FormattedMessage id="teacher.back.title" />
          </h2>
          <p className={styles.muted}>
            <FormattedMessage id={teaching ? 'teacher.back.body' : 'teacher.back.switching'} />
          </p>
          {state.settingError && (
            <p className={styles.danger} role="alert">
              {settingErrorText(intl, state.settingError)}
            </p>
          )}
          <div className={styles.actions}>
            <Button
              variant="secondary"
              loading={state.saving === 'mode'}
              onClick={() =>
                void feature.setMode('normal').then((done) => {
                  if (done) void navigate(paths.home);
                })
              }
            >
              <FormattedMessage id="teacher.back.action" />
            </Button>
          </div>
        </section>
      </Card>
    </div>
  );

  // Compact: the greeting above what it is about. Wide: beside it.
  return layout === 'wide' ? (
    <SplitStage aside={hero}>{panel}</SplitStage>
  ) : (
    <Stage>
      {hero}
      {panel}
    </Stage>
  );
}
