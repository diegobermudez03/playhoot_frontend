import { joinCodeAlphabet, joinCodeLength } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { operations } from '@playhoot/protocol';

import { useNavigateToOperation } from '../access';
import { useLayout } from '../layout';
import { joinPath, newSessionPath } from '../paths';
import { AppShell, Button, Card, CodeInput, Logo, SplitStage, Stage } from '../../ui';
import styles from './EnterCodeRoute.module.css';

// `/join`: type a join code. The entry to the Join Session feature for someone without a link.
// Not the home page: `/` only redirects here until a real home exists.
export function EnterCodeRoute() {
  const intl = useIntl();
  const navigate = useNavigate();
  // Shown to everyone; without an account, choosing it goes through signing in first.
  const goTo = useNavigateToOperation();
  const layout = useLayout();
  const [code, setCode] = useState('');
  const complete = code.length === joinCodeLength;

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (complete) navigate(joinPath(code));
  };

  const hero = (
    <div className={styles.hero}>
      <Logo size="lg" />
      <p className={styles.tagline}>
        <FormattedMessage id="app.tagline" />
      </p>
    </div>
  );
  const form = (
    <Card>
      <form className={styles.form} onSubmit={join}>
        <h1 className={styles.title}>
          <FormattedMessage id="enterCode.title" />
        </h1>
        <CodeInput
          value={code}
          onChange={setCode}
          length={joinCodeLength}
          alphabet={joinCodeAlphabet}
          label={intl.formatMessage({ id: 'enterCode.codeLabel' })}
          autoFocus
        />
        <Button type="submit" size="lg" block disabled={!complete}>
          <FormattedMessage id="enterCode.join" />
        </Button>
      </form>
    </Card>
  );
  const footnote = (
    <>
      <p className={styles.footnote}>
        <FormattedMessage id="enterCode.footnote" />
      </p>
      <Button variant="ghost" block onClick={() => goTo(operations.createSession, newSessionPath)}>
        <FormattedMessage id="createSession.button" />
      </Button>
    </>
  );

  // Compact: the logo above the form. Wide: the logo beside it, so a phone held sideways shows the
  // whole form with its keyboard up.
  return (
    <AppShell bare>
      {layout === 'wide' ? (
        <SplitStage aside={hero}>
          {form}
          {footnote}
        </SplitStage>
      ) : (
        <Stage>
          {hero}
          {form}
          {footnote}
        </Stage>
      )}
    </AppShell>
  );
}
