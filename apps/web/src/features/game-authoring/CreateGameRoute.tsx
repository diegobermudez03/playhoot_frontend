import { cardLimits, operations } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';

import { useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Owl, Stage, TextField } from '../../ui';
import { RequireOperation } from '../access';
import { gameWorkspacePath } from '../paths';
import styles from './GameWorkspace.module.css';

// `/games/new`: asks the game's name (its preliminary card name, confirmed when it is published),
// creates the game (an account's operation) and moves to its workspace, replacing this URL so
// going back does not create another one.
export function CreateGameRoute() {
  return (
    <RequireOperation operation={operations.createGame}>
      <CreateGame />
    </RequireOperation>
  );
}

type Failure = 'invalid-name' | 'other';

function CreateGame() {
  const services = useServices();
  const intl = useIntl();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  // One key per name: a retry of the same name creates one game; another name is another request.
  const [request, setRequest] = useState(() => ({ name: '', key: crypto.randomUUID() }));
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const trimmed = name.trim();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    if (trimmed === '' || [...trimmed].length > cardLimits.nameMax) {
      setFailure('invalid-name');
      return;
    }
    const current =
      request.name === trimmed ? request : { name: trimmed, key: crypto.randomUUID() };
    setRequest(current);
    setCreating(true);
    setFailure(null);
    const result = await services.gamesApi.createGame(current.name, current.key);
    if (result.ok) {
      navigate(gameWorkspacePath(result.value.gameUUID), { replace: true });
      return;
    }
    setCreating(false);
    setFailure(result.error.kind === 'invalid-card' ? 'invalid-name' : 'other');
  };

  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <Owl size={112} animated={creating} mood={failure === 'other' ? 'surprised' : 'happy'} />
          <h1 className={styles.heroTitle}>
            <FormattedMessage id="createGame.title" />
          </h1>
          <p className={styles.muted}>
            <FormattedMessage id="createGame.lead" />
          </p>
        </div>
        <Card>
          <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
            <TextField
              label={intl.formatMessage({ id: 'createGame.nameLabel' })}
              placeholder={intl.formatMessage({ id: 'createGame.namePlaceholder' })}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={cardLimits.nameMax}
              autoFocus
              error={
                failure === 'invalid-name'
                  ? intl.formatMessage(
                      { id: 'createGame.nameInvalid' },
                      { max: cardLimits.nameMax },
                    )
                  : null
              }
              hint={intl.formatMessage({ id: 'createGame.nameHint' })}
            />
            {failure === 'other' && (
              <p className={styles.warningText} role="alert">
                <FormattedMessage id="createGame.error" />
              </p>
            )}
            <Button type="submit" size="lg" block loading={creating}>
              <FormattedMessage id="createGame.submit" />
            </Button>
          </form>
        </Card>
      </Stage>
    </AppShell>
  );
}
