import { createGuestSignIn, type GuestSignIn, type IdentityError } from '@playhoot/feature-sign-in';
import { guestDisplayNameMaxLength } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { Link, Navigate, useLocation } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Owl, SplitStage, Stage, TextField } from '../../ui';
import { useLayout } from '../layout';
import { joinCodeOf, safeNext, signInPath } from '../paths';
import styles from './SignIn.module.css';

// `/sign-in/guest?next=…`: play as a guest by giving a name, the easiest way in for an operation
// that allows guests, with the option to sign in or register instead. Continues to `next`.
export function GuestSignInRoute() {
  const auth = useAuth();
  const location = useLocation();
  const next = safeNext(location.search);
  // Already someone: nothing to do here.
  if (auth.status === 'guest' || auth.status === 'authenticated')
    return <Navigate to={next ?? '/'} replace />;
  return <GuestSignInScreen next={next} />;
}

function GuestSignInScreen({ next }: { next: string | null }) {
  const intl = useIntl();
  const layout = useLayout();
  const signIn = useGuestSignIn();
  const state = useStore(signIn.store);
  const [name, setName] = useState('');
  const joinCode = joinCodeOf(next);

  // Once signed in, the route itself continues to `next`.
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn.submit(name);
  };

  const hero = (
    <div className={styles.hero}>
      <Owl size={88} />
      <h1 className={styles.title}>
        <FormattedMessage id="identity.title" />
      </h1>
      {joinCode && (
        <p className={styles.lead}>
          <FormattedMessage id="identity.joining" values={{ code: joinCode }} />
        </p>
      )}
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
          <FormattedMessage id="identity.submit" />
        </Button>
      </form>
    </Card>
  );
  const alternative = (
    <p className={styles.alternative}>
      <FormattedMessage
        id="identity.useAccount"
        values={{ link: (text) => <Link to={signInPath(next ?? undefined)}>{text}</Link> }}
      />
    </p>
  );

  // Compact: the owl above the form. Wide: beside it, so the form stays whole above a keyboard.
  return (
    <AppShell>
      {layout === 'wide' ? (
        <SplitStage aside={hero}>
          {form}
          {alternative}
        </SplitStage>
      ) : (
        <Stage>
          {hero}
          {form}
          {alternative}
        </Stage>
      )}
    </AppShell>
  );
}

// One instance per visit to the page; nothing to release when leaving it.
function useGuestSignIn(): GuestSignIn {
  const services = useServices();
  const [signIn] = useState(() =>
    createGuestSignIn({
      app: services.app,
      identity: services.identity,
      newIdempotencyKey: () => crypto.randomUUID(),
      onTelemetry: services.telemetry.signIn,
    }),
  );
  return signIn;
}

export function identityErrorText(intl: IntlShape, error: IdentityError): string {
  switch (error.kind) {
    case 'invalid-name':
      return error.reason === 'empty'
        ? intl.formatMessage({ id: 'identity.error.empty' })
        : error.reason === 'too-long'
          ? intl.formatMessage({ id: 'identity.error.tooLong' }, { max: error.maxLength })
          : intl.formatMessage({ id: 'identity.error.rejected' });
    case 'rate-limited':
      return intl.formatMessage(
        { id: 'identity.error.rateLimited' },
        { seconds: error.retryAfterSeconds ?? 0 },
      );
    case 'unavailable':
      return intl.formatMessage({ id: 'identity.error.unavailable' });
  }
}
