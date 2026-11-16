import {
  createAcceptanceStep,
  type AcceptanceStep,
  type AcceptanceStepState,
  type PendingAcceptance,
} from '@playhoot/feature-compliance';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { useLocale } from '../../i18n/LocaleContext';
import { segmentOfLocale } from '../../i18n/localePaths';
import { Button, Card, Checkbox, Dialog, Mascot, Stage } from '../../ui';
import styles from './Compliance.module.css';

// The one step a sign-in leads to when the account has no standing acceptance of the current
// terms and own-data texts — a new account, or a version that changed since (D-037). It sits
// where the display-name gate sits, above every page, because a sign-in can finish on the
// authentication screen or on the provider's completion route and both have to meet it. Guests
// never do: only an account is gated (C-01). A text that cannot be read now is not asked for, so
// this never becomes a locked door; the next sign-in asks again.
export function AcceptanceGate({ children }: { children: ReactNode }) {
  const { compliance } = useServices();
  const { locale } = useLocale();
  const [step] = useState(() => createAcceptanceStep({ compliance }));
  const state = useStore(step.store);

  // Asked once, in the language the person was reading when they arrived: an acceptance points at
  // the exact version read, and switching language later is not a reason to ask again.
  const [language] = useState(() => segmentOfLocale(locale));
  useEffect(() => {
    void step.load(language);
  }, [step, language]);

  if (state.status === 'unknown') return null;
  if (state.status === 'none') return <>{children}</>;
  return <AcceptanceScreen step={step} state={state} />;
}

function AcceptanceScreen({ step, state }: { step: AcceptanceStep; state: AcceptanceStepState }) {
  const intl = useIntl();
  const [agreed, setAgreed] = useState(false);
  const [missed, setMissed] = useState(false);
  const [reading, setReading] = useState<PendingAcceptance | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // The step is a page of its own: focus lands on what it is asking.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const submit = () => {
    if (!agreed) {
      setMissed(true);
      return;
    }
    void step.accept();
  };

  return (
    <>
      <Stage>
        <div className={styles.hero}>
          <Mascot size={88} />
          <h1 className={styles.title} tabIndex={-1} ref={heading}>
            <FormattedMessage id="acceptance.title" />
          </h1>
          <p className={styles.lead}>
            <FormattedMessage id="acceptance.lead" />
          </p>
        </div>
        <Card>
          <div className={styles.form}>
            <ul className={styles.textList}>
              {state.texts.map((text) => (
                <li key={text.kind} className={styles.textRow}>
                  <Button variant="ghost" onClick={() => setReading(text)}>
                    <FormattedMessage
                      id="acceptance.read"
                      values={{ text: textName(intl, text.kind) }}
                    />
                  </Button>
                  <span className={styles.version}>
                    <FormattedMessage id="acceptance.version" values={{ version: text.version }} />
                  </span>
                </li>
              ))}
            </ul>
            <Checkbox
              label={
                <FormattedMessage id="acceptance.agree" values={{ count: state.texts.length }} />
              }
              checked={agreed}
              onChange={(event) => {
                setAgreed(event.target.checked);
                setMissed(false);
              }}
              error={missed ? intl.formatMessage({ id: 'acceptance.required' }) : null}
            />
            {state.failed && (
              <p className={styles.notice} role="alert">
                <FormattedMessage id="acceptance.failed" />
              </p>
            )}
            <Button size="lg" block loading={state.status === 'recording'} onClick={submit}>
              <FormattedMessage id="acceptance.submit" />
            </Button>
          </div>
        </Card>
      </Stage>
      <Dialog
        open={reading !== null}
        title={reading ? textName(intl, reading.kind) : ''}
        closeLabel={intl.formatMessage({ id: 'acceptance.close' })}
        onClose={() => setReading(null)}
      >
        <p className={styles.textContent}>{reading?.content}</p>
      </Dialog>
    </>
  );
}

// The name of a text this build knows; one it does not is named by what the backend called it,
// which is still better than nothing (T-204 rule).
export function textName(intl: IntlShape, kind: string): string {
  switch (kind) {
    case 'terms':
      return intl.formatMessage({ id: 'text.terms' });
    case 'own-data':
      return intl.formatMessage({ id: 'text.ownData' });
    case 'class-data-agreement':
      return intl.formatMessage({ id: 'text.classDataAgreement' });
    case 'marketing':
      return intl.formatMessage({ id: 'text.marketing' });
    default:
      return kind;
  }
}
