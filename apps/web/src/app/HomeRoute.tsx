import { joinCodeAlphabet, joinCodeLength } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';

import { joinPath } from '../features/paths';
import { AppShell, Button, Card, CodeInput, Logo, Stage } from '../ui';
import styles from './HomeRoute.module.css';

export function HomeRoute() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const complete = code.length === joinCodeLength;

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (complete) navigate(joinPath(code));
  };

  return (
    <AppShell bare>
      <Stage>
        <div className={styles.hero}>
          <Logo size="lg" />
          <p className={styles.tagline}>
            <FormattedMessage id="app.tagline" />
          </p>
        </div>
        <Card>
          <form className={styles.form} onSubmit={join}>
            <h1 className={styles.title}>
              <FormattedMessage id="home.title" />
            </h1>
            <CodeInput
              value={code}
              onChange={setCode}
              length={joinCodeLength}
              alphabet={joinCodeAlphabet}
              label={intl.formatMessage({ id: 'home.codeLabel' })}
              autoFocus
            />
            <Button type="submit" size="lg" block disabled={!complete}>
              <FormattedMessage id="home.join" />
            </Button>
          </form>
        </Card>
        <p className={styles.footnote}>
          <FormattedMessage id="home.footnote" />
        </p>
      </Stage>
    </AppShell>
  );
}
