import type { SignInMethod } from '@playhoot/communication';
import { createSignInMethods, type SignInMethods } from '@playhoot/feature-account';
import { emailCodeAlphabet, emailCodeLength, operations } from '@playhoot/protocol';
import { useEffect, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { useLocation } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { segmentOfLocale } from '../../i18n/localePaths';
import { useLocale } from '../../i18n/LocaleContext';
import { Button, Card, CodeInput, Dialog, PageHeading, Stage, TextField } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout } from '../layout';
import { methodLinkOutcome, profilePaths } from '../paths';
import styles from './Account.module.css';
import { linkEmailErrorText, methodsErrorText, removeMethodErrorText } from './accountErrors';

// `/profile/methods`: the ways into this account (P03§11-12, D-035). Adding an address asks for
// the code sent to it; adding a provider leaves for it and comes back through the completion
// route, which returns here saying how it went. The last way in cannot be removed, because
// signing in through a linked method is how an account is recovered — which is also why this
// screen recommends adding the address way in.
export function MethodsRoute() {
  return (
    <RequireOperation operation={operations.manageSignInMethods} reason="sign-in">
      <Methods />
    </RequireOperation>
  );
}

function Methods() {
  const intl = useIntl();
  const layout = useLayout();
  const location = useLocation();
  const { identity } = useServices();
  const [feature] = useState(() => createSignInMethods({ identity }));
  const state = useStore(feature.store);
  // How a provider round trip that has just come back went; the address is what carries it.
  const linkOutcome = methodLinkOutcome(location.search);

  useEffect(() => {
    void feature.load();
  }, [feature]);

  return (
    <Stage wide={layout === 'wide'}>
      <div className={styles.page}>
        <PageHeading
          title={intl.formatMessage({ id: 'methods.title' })}
          lead={intl.formatMessage({ id: 'methods.lead' })}
        />
        {linkOutcome === 'in-use' && (
          <p className={styles.danger} role="alert">
            <FormattedMessage id="methods.error.inUse" />
          </p>
        )}
        {(linkOutcome === 'linked' || state.linked) && (
          <p className={styles.muted} role="status">
            <FormattedMessage id="methods.linked" />
          </p>
        )}
        <div className={layout === 'wide' ? styles.columns : styles.page}>
          <LinkedList feature={feature} />
          <AddSection feature={feature} />
        </div>
        <p className={styles.subtle}>
          <FormattedMessage id="methods.noMerge" />
        </p>
      </div>
    </Stage>
  );
}

function LinkedList({ feature }: { feature: SignInMethods }) {
  const intl = useIntl();
  const state = useStore(feature.store);
  const [confirming, setConfirming] = useState<SignInMethod | null>(null);
  const last = state.methods.length <= 1;

  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="methods.linkedTitle" />
        </h2>
        {state.status === 'loading' && state.methods.length === 0 && (
          <p className={styles.muted}>
            <FormattedMessage id="methods.loading" />
          </p>
        )}
        {state.status === 'failed' && state.error && (
          <p className={styles.danger} role="alert">
            {methodsErrorText(intl, state.error)}
          </p>
        )}
        {state.removeError && (
          <p className={styles.danger} role="alert">
            {removeMethodErrorText(intl, state.removeError)}
          </p>
        )}
        <ul className={styles.list}>
          {state.methods.map((method) => (
            <li key={method.methodID} className={styles.item}>
              <span className={styles.itemText}>
                <span className={styles.itemName}>{issuerName(intl, method.issuer)}</span>
                {method.address && <span className={styles.linkNote}>{method.address}</span>}
                <span className={styles.linkNote}>
                  <FormattedMessage
                    id="methods.added"
                    values={{
                      date: intl.formatDate(method.addedAt, { dateStyle: 'medium' }),
                    }}
                  />
                </span>
              </span>
              <span className={styles.actions}>
                <Button
                  variant="secondary"
                  disabled={last || state.removing !== null}
                  loading={state.removing === method.methodID}
                  onClick={() => setConfirming(method)}
                >
                  <FormattedMessage id="methods.remove" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
        {state.status === 'ready' && (
          <p className={styles.subtle}>
            <FormattedMessage id={last ? 'methods.lastOneHere' : 'methods.recommendEmail'} />
          </p>
        )}
      </section>
      <Dialog
        open={confirming !== null}
        title={intl.formatMessage({ id: 'methods.confirmRemoveTitle' })}
        closeLabel={intl.formatMessage({ id: 'common.close' })}
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const method = confirming;
                setConfirming(null);
                if (method) void feature.remove(method.methodID);
              }}
            >
              <FormattedMessage id="methods.remove" />
            </Button>
          </>
        }
      >
        <p className={styles.muted}>
          <FormattedMessage
            id="methods.confirmRemoveBody"
            values={{ method: confirming ? issuerName(intl, confirming.issuer) : '' }}
          />
        </p>
      </Dialog>
    </Card>
  );
}

// Adding a way in: an address proved with a code, or a provider proved the way signing in is.
function AddSection({ feature }: { feature: SignInMethods }) {
  const intl = useIntl();
  const { locale } = useLocale();
  const { accountSignIn } = useServices();
  const signIn = useStore(accountSignIn.store);
  const state = useStore(feature.store);
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const language = segmentOfLocale(locale);

  useEffect(() => {
    void accountSignIn.loadProviders();
  }, [accountSignIn]);

  const offers = (provider: string) => signIn.providers?.includes(provider) ?? false;
  const error = state.linkError ? linkEmailErrorText(intl, state.linkError) : null;

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    void feature.startEmail(address, language);
  };
  const confirmCode = (event: FormEvent) => {
    event.preventDefault();
    void feature.completeEmail(code).then((done) => {
      if (done) {
        setAddress('');
        setCode('');
      }
    });
  };

  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="methods.addTitle" />
        </h2>
        {state.adding?.step === 'code' ? (
          <form className={styles.form} onSubmit={confirmCode} noValidate>
            <p className={styles.muted}>
              <FormattedMessage id="methods.email.sent" values={{ address: state.adding.email }} />
            </p>
            <CodeInput
              value={code}
              onChange={setCode}
              length={emailCodeLength}
              alphabet={emailCodeAlphabet}
              label={intl.formatMessage({ id: 'emailCode.codeLabel' })}
              labelVisible
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              error={error}
              hint={intl.formatMessage({ id: 'emailCode.codeHint' })}
            />
            <div className={styles.actions}>
              <Button type="submit" loading={state.busy} disabled={code.length !== emailCodeLength}>
                <FormattedMessage id="methods.email.confirm" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCode('');
                  feature.cancelEmail();
                }}
              >
                <FormattedMessage id="common.cancel" />
              </Button>
            </div>
          </form>
        ) : (
          <form className={styles.form} onSubmit={sendCode} noValidate>
            <TextField
              label={intl.formatMessage({ id: 'methods.email.label' })}
              placeholder={intl.formatMessage({ id: 'emailCode.addressPlaceholder' })}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              error={error}
              hint={intl.formatMessage({ id: 'methods.email.hint' })}
            />
            <div className={styles.actions}>
              <Button type="submit" loading={state.busy}>
                <FormattedMessage id="methods.email.send" />
              </Button>
            </div>
          </form>
        )}
        <div className={styles.stack}>
          <p className={styles.subtle}>
            <FormattedMessage id="methods.provider.lead" />
          </p>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              disabled={!offers('google') || signIn.status === 'starting'}
              onClick={() => void accountSignIn.startLink('google', profilePaths.methods)}
            >
              <FormattedMessage id="methods.provider.google" />
            </Button>
            {offers('local') && (
              <Button
                variant="secondary"
                disabled={signIn.status === 'starting'}
                onClick={() => void accountSignIn.startLink('local', profilePaths.methods)}
              >
                <FormattedMessage id="methods.provider.local" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </Card>
  );
}

// What each way in is called, in the reader's language. The backend's list is open: one this
// build does not know is still shown, named by the issuer the backend sent.
function issuerName(intl: IntlShape, issuer: string): string {
  switch (issuer) {
    case 'google':
      return intl.formatMessage({ id: 'methods.issuer.google' });
    case 'email':
      return intl.formatMessage({ id: 'methods.issuer.email' });
    case 'local':
      return intl.formatMessage({ id: 'methods.issuer.local' });
    default:
      return issuer;
  }
}
