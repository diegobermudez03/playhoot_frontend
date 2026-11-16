import type { TemplateEntry } from '@playhoot/communication';
import { cardLimits, operations } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router';

import { useServices } from '../../app/ServicesContext';
import { Button, Card, Mascot, Stage, TextField } from '../../ui';
import { RequireOperation } from '../access';
import {
  declarationScreenPath,
  gameWorkspacePath,
  newGamePathWith,
  newGameRequest,
} from '../paths';
import styles from './GameWorkspace.module.css';
import { TemplatePicker } from './TemplatePicker';

// `/games/new`: asks the game's name (its preliminary card name, confirmed when it is published),
// creates the game (an account's operation) and moves to its workspace, replacing this URL so
// going back does not create another one.
export function CreateGameRoute() {
  return (
    <RequireOperation operation={operations.createGame} reason="create-game">
      <CreateGame />
    </RequireOperation>
  );
}

type Failure = 'invalid-name' | 'template' | 'restricted' | 'other';

function CreateGame() {
  const services = useServices();
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  // What this screen was left with when it sent the person to the declaration: its address
  // carries it, so coming back asks for none of it again (WCAG 2.2 3.3.7).
  const [left] = useState(() => newGameRequest(location.search));
  const [name, setName] = useState(left.name);
  // The template the game starts from; null is the starter project.
  // Only what the request and the summary need: the rest of a template is not worth carrying
  // through the address.
  const [template, setTemplate] = useState<Pick<TemplateEntry, 'gameUUID' | 'name'> | null>(
    left.template,
  );
  // One key per name and template: a retry of the same request creates one game; another name or
  // template is another request.
  const [request, setRequest] = useState(() => ({
    name: '',
    template: null as string | null,
    key: crypto.randomUUID(),
  }));
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
    const chosen = template?.gameUUID ?? null;

    const current =
      request.name === trimmed && request.template === chosen
        ? request
        : { name: trimmed, template: chosen, key: crypto.randomUUID() };
    setRequest(current);
    setCreating(true);
    setFailure(null);
    const result = await services.gamesApi.createGame(
      current.name,
      current.key,
      current.template ?? undefined,
    );
    if (result.ok) {
      navigate(gameWorkspacePath(result.value.gameUUID), { replace: true });
      return;
    }
    // Creating games is gated by the market matrix (D-038): the declaration is asked for the way
    // a missing account is, and this screen is where the person comes back to.
    if (result.error.kind === 'declaration-required') {
      navigate(declarationScreenPath(result.error.function, newGamePathWith(trimmed, template)));
      return;
    }
    setCreating(false);
    setFailure(
      result.error.kind === 'invalid-card'
        ? 'invalid-name'
        : result.error.kind === 'template-not-found'
          ? 'template'
          : result.error.kind === 'market-restricted'
            ? 'restricted'
            : 'other',
    );
  };

  return (
    <>
      <Stage>
        <div className={styles.hero}>
          <Mascot
            size={112}
            animated={creating}
            mood={failure === 'other' ? 'surprised' : 'happy'}
          />
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
            <div className={styles.summary}>
              <p className={styles.summaryTitle}>
                <FormattedMessage id="createGame.startTitle" />
              </p>
              <p className={styles.muted} data-testid="create-start">
                {template ? (
                  <FormattedMessage id="createGame.fromTemplate" values={{ name: template.name }} />
                ) : (
                  <FormattedMessage id="createGame.fromStarter" />
                )}
              </p>
              {template && (
                <div className={styles.rowActions}>
                  <Button variant="ghost" onClick={() => setTemplate(null)}>
                    <FormattedMessage id="createGame.useStarter" />
                  </Button>
                </div>
              )}
            </div>
            {failure === 'template' && (
              <p className={styles.warningText} role="alert">
                <FormattedMessage id="createGame.templateGone" />
              </p>
            )}
            {failure === 'restricted' && (
              <p className={styles.warningText} role="alert">
                <FormattedMessage id="createGame.restricted" />
              </p>
            )}
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
        {/* Outside the form: the picker has its own search form. */}
        <Card>
          <TemplatePicker
            chosen={template?.gameUUID ?? null}
            onChoose={setTemplate}
            chooseLabel="templates.choose"
          />
        </Card>
      </Stage>
    </>
  );
}
