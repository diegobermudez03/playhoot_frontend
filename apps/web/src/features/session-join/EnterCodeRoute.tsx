import { joinCodeAlphabet, joinCodeLength } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { operations } from '@playhoot/protocol';

import { useShellMode } from '../../app/shell/ShellContext';
import { useNavigateToOperation } from '../access';
import { useMediaLayout } from '../layout';
import { joinPath, myGamesPath, newGamePath, newSessionPath } from '../paths';
import { Button, Card, CodeInput, Logo, SplitStage, Stage } from '../../ui';
import styles from './EnterCodeRoute.module.css';

// `/join`: type a join code. The entry to the Join Session feature for someone without a link.
// Not the home page: `/` only redirects here until a real home exists.
export function EnterCodeRoute() {
  const intl = useIntl();
  const navigate = useNavigate();
  // Shown to everyone; without an account, choosing it goes through signing in first.
  const goTo = useNavigateToOperation();
  // The server renders this page and knows nothing about the display, so the skeleton is chosen
  // from a media query after hydration (D-019).
  const layout = useMediaLayout();
  // The page shows its own big logo, so the bar does not repeat it. `AppShell` already reads that
  // from the address, so the first render is right too; this keeps the screen's own statement.
  useShellMode('bare');
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
      <Button
        variant="ghost"
        block
        onClick={() => goTo(operations.createSession, newSessionPath, 'create-session')}
      >
        <FormattedMessage id="createSession.button" />
      </Button>
      <Button
        variant="ghost"
        block
        onClick={() => goTo(operations.createGame, newGamePath, 'create-game')}
      >
        <FormattedMessage id="createGame.button" />
      </Button>
      <Button
        variant="ghost"
        block
        onClick={() => goTo(operations.editGame, myGamesPath, 'my-games')}
      >
        <FormattedMessage id="myGames.button" />
      </Button>
    </>
  );

  // Compact: the logo above the form. Wide: the logo beside it, so a phone held sideways shows the
  // whole form with its keyboard up.
  return (
    <>
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
    </>
  );
}
