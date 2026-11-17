import type { AcceptanceText, MyDeclaration } from '@playhoot/communication';
import { createMyData } from '@playhoot/feature-account';
import { operations, textKinds } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { useLocale } from '../../i18n/LocaleContext';
import { segmentOfLocale } from '../../i18n/localePaths';
import { Button, Card, Dialog, PageHeading, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { textName } from '../compliance/AcceptanceGate';
import { countryName, subdivisionName } from '../compliance/places';
import { useLayout } from '../layout';
import styles from './Account.module.css';
import { myDataErrorText } from './accountErrors';

// `/profile/legal`: what the person declared and what they accepted. Nothing here edits
// anything: a wrong declaration is corrected through support, not by answering again (P19§3),
// and what was declared is shown as declared — never as verified (P19§1).
export function LegalRoute() {
  return (
    <RequireOperation operation={operations.viewOwnIdentity} reason="sign-in">
      <Legal />
    </RequireOperation>
  );
}

function Legal() {
  const intl = useIntl();
  const layout = useLayout();
  const { app, me, identity } = useServices();
  const [feature] = useState(() => createMyData({ app, me, identity }));
  const state = useStore(feature.store);

  useEffect(() => {
    void feature.load();
  }, [feature]);

  return (
    <Stage wide={layout === 'wide'}>
      <div className={styles.page}>
        <PageHeading
          title={intl.formatMessage({ id: 'legal.title' })}
          lead={intl.formatMessage({ id: 'legal.lead' })}
        />
        {state.status === 'failed' && state.error && (
          <p className={styles.danger} role="alert">
            {myDataErrorText(intl, state.error)}
          </p>
        )}
        <div className={layout === 'wide' ? styles.columns : styles.page}>
          <DeclarationSection
            known={state.data?.declarationKnown ?? false}
            declaration={state.data?.declaration ?? null}
            loading={state.status === 'loading' && state.data === null}
          />
          <TextsSection />
        </div>
      </div>
    </Stage>
  );
}

function DeclarationSection({
  known,
  declaration,
  loading,
}: {
  known: boolean;
  declaration: MyDeclaration | null;
  loading: boolean;
}) {
  const intl = useIntl();
  const { locale } = useLocale();
  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="legal.declaration.title" />
        </h2>
        {loading ? (
          <p className={styles.muted}>
            <FormattedMessage id="legal.loading" />
          </p>
        ) : !known ? (
          // Compliance could not be asked: unknown is not the same as none.
          <p className={styles.muted}>
            <FormattedMessage id="legal.declaration.unknown" />
          </p>
        ) : declaration === null ? (
          <p className={styles.muted}>
            <FormattedMessage id="legal.declaration.none" />
          </p>
        ) : (
          <>
            <dl className={styles.pairs}>
              <dt className={styles.pairTerm}>
                <FormattedMessage id="legal.declaration.country" />
              </dt>
              <dd className={styles.pairValue}>{countryName(locale, declaration.country)}</dd>
              {declaration.subdivision && (
                <>
                  <dt className={styles.pairTerm}>
                    <FormattedMessage id="legal.declaration.subdivision" />
                  </dt>
                  <dd className={styles.pairValue}>
                    {subdivisionName(declaration.country, declaration.subdivision)}
                  </dd>
                </>
              )}
              <dt className={styles.pairTerm}>
                <FormattedMessage id="legal.declaration.age" />
              </dt>
              <dd className={styles.pairValue}>
                <FormattedMessage
                  id={declaration.meetsAge ? 'legal.declaration.meets' : 'legal.declaration.below'}
                  values={{ age: declaration.thresholdAge }}
                />
              </dd>
              <dt className={styles.pairTerm}>
                <FormattedMessage id="legal.declaration.when" />
              </dt>
              <dd className={styles.pairValue}>
                {intl.formatDate(declaration.declaredAt, { dateStyle: 'medium' })}
              </dd>
            </dl>
            <p className={styles.subtle}>
              <FormattedMessage id="legal.declaration.asDeclared" />
            </p>
          </>
        )}
        <p className={styles.subtle}>
          <FormattedMessage id="declaration.correction" />
        </p>
      </section>
    </Card>
  );
}

// Every text with its current version, whether this person accepted it and when, and the
// download the class agreement in particular needs (P22§2).
function TextsSection() {
  const intl = useIntl();
  const { compliance } = useServices();
  const { locale } = useLocale();
  const language = segmentOfLocale(locale);
  const [texts, setTexts] = useState<Record<string, AcceptanceText | null>>({});
  const [open, setOpen] = useState<AcceptanceText | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      textKinds.map(async (kind) => {
        const result = await compliance.readText(kind, language);
        return [kind, result.ok ? result.value : null] as const;
      }),
    ).then((entries) => {
      // A text that is not published yet (P-23) or could not be read is said to be missing, not
      // invented.
      if (!cancelled) setTexts(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [compliance, language]);

  return (
    <Card>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="legal.texts.title" />
        </h2>
        <ul className={styles.list}>
          {textKinds.map((kind) => {
            const text = texts[kind];
            return (
              <li key={kind} className={styles.item}>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{textName(intl, kind)}</span>
                  <span className={styles.linkNote}>
                    {text ? (
                      <FormattedMessage
                        id="acceptance.version"
                        values={{ version: text.version }}
                      />
                    ) : (
                      <FormattedMessage id="texts.notPublished" />
                    )}
                  </span>
                  <span className={styles.linkNote}>
                    <FormattedMessage
                      id={text?.accepted ? 'legal.texts.accepted' : 'legal.texts.notAccepted'}
                    />
                  </span>
                </span>
                {text && (
                  <span className={styles.actions}>
                    <Button variant="secondary" onClick={() => setOpen(text)}>
                      <FormattedMessage id="legal.texts.read" />
                    </Button>
                    <a
                      className={styles.download}
                      href={compliance.textDownloadUrl(kind, text.language)}
                      download
                    >
                      <FormattedMessage id="texts.download" />
                    </a>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <Dialog
        open={open !== null}
        title={open ? textName(intl, open.kind) : ''}
        closeLabel={intl.formatMessage({ id: 'acceptance.close' })}
        onClose={() => setOpen(null)}
        actions={
          open ? (
            <a
              className={styles.download}
              href={compliance.textDownloadUrl(open.kind, open.language)}
              download
            >
              <FormattedMessage id="texts.download" />
            </a>
          ) : null
        }
      >
        {open && (
          <>
            <p className={styles.subtle}>
              <FormattedMessage id="acceptance.version" values={{ version: open.version }} />
            </p>
            <p className={styles.textContent}>{open.content}</p>
          </>
        )}
      </Dialog>
    </Card>
  );
}
