import { createDisplayNameSetup, type DisplayNameSetup } from '@playhoot/feature-sign-in';
import { guestDisplayNameMaxLength } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Owl, SplitStage, Stage, TextField } from '../../ui';
import { useLayout } from '../layout';
import { identityErrorText } from './GuestSignInRoute';
import styles from './SignIn.module.css';

// Shown instead of any page while the account has no display name (an account starts without
// one): the person chooses it once, and the page they were on appears as soon as it is kept.
export function DisplayNameScreen() {
  const intl = useIntl();
  const layout = useLayout();
  const setup = useDisplayNameSetup();
  const state = useStore(setup.store);
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void setup.submit(name);
  };

  const hero = (
    <div className={styles.hero}>
      <Owl size={88} />
      <h1 className={styles.title}>
        <FormattedMessage id="displayName.title" />
      </h1>
      <p className={styles.lead}>
        <FormattedMessage id="displayName.lead" />
      </p>
    </div>
  );
  const form = (
    <Card>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField
          label={intl.formatMessage({ id: 'identity.nameLabel' })}
          placeholder={intl.formatMessage({ id: 'identity.namePlaceholder' })}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={guestDisplayNameMaxLength}
          autoComplete="nickname"
          autoFocus
          error={state.error ? identityErrorText(intl, state.error) : null}
          hint={intl.formatMessage({ id: 'identity.nameHint' })}
        />
        <Button type="submit" size="lg" block loading={state.submitting}>
          <FormattedMessage id="displayName.submit" />
        </Button>
      </form>
    </Card>
  );

  return (
    <AppShell>
      {layout === 'wide' ? (
        <SplitStage aside={hero}>{form}</SplitStage>
      ) : (
        <Stage>
          {hero}
          {form}
        </Stage>
      )}
    </AppShell>
  );
}

function useDisplayNameSetup(): DisplayNameSetup {
  const services = useServices();
  const [setup] = useState(() =>
    createDisplayNameSetup({ app: services.app, identity: services.identity }),
  );
  return setup;
}
