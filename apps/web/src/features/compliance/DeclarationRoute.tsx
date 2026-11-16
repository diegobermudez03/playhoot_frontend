import { createDeclarationForm, type DeclarationError } from '@playhoot/feature-compliance';
import { operations, type MarketFunction } from '@playhoot/protocol';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { useLocation, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { useLocale } from '../../i18n/LocaleContext';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, Checkbox, Dialog, Mascot, Select, SplitStage, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout } from '../layout';
import { declarationRequest, type DeclarationRequest } from '../paths';
import styles from './Compliance.module.css';
import { countryOptions, subdivisionsByCountry } from './places';

// `/declaration`: where a gated function sends a person who has not said where they live and
// that they have the age that place asks for (P19§1, D-038). Its address is its whole input —
// the function that asked and where to continue — so a copied link reproduces the screen, and
// returning to `next` asks for nothing that was already typed (WCAG 2.2 3.3.7).
export function DeclarationRoute() {
  const location = useLocation();
  const request = declarationRequest(location.search);
  return (
    <RequireOperation operation={operations.declareResidenceAndAge} reason="sign-in">
      <DeclarationScreen request={request} />
    </RequireOperation>
  );
}

function DeclarationScreen({ request }: { request: DeclarationRequest }) {
  const intl = useIntl();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  const { locale } = useLocale();
  const { compliance } = useServices();
  const layout = useLayout();
  const [form] = useState(() => createDeclarationForm({ compliance }));
  const state = useStore(form.store);
  const countries = useMemo(() => countryOptions(locale), [locale]);

  const [country, setCountry] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [meetsAge, setMeetsAge] = useState(false);
  const [missed, setMissed] = useState(false);
  // Open while the person is confirming that they are below the age: it is recorded, it is
  // binding, and the function stays unavailable (P19§3).
  const [confirmingBelow, setConfirmingBelow] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const known = subdivisionsByCountry[country];
  // The backend decides where a state or province is needed; these are the places whose rules
  // are kept that way, and a refusal makes the field appear for any country.
  const subdivisions = known ?? (state.needsSubdivision && country ? [] : undefined);
  const subdivisionNeeded = subdivisions !== undefined;

  const record = (declaresAge: boolean) => {
    setConfirmingBelow(false);
    void form.submit(country, subdivisionNeeded ? subdivision : '', declaresAge);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!country || (subdivisionNeeded && known && !subdivision) || !meetsAge) {
      setMissed(true);
      return;
    }
    record(true);
  };

  // Recorded and old enough: back to what asked, which now goes ahead.
  const done = state.status === 'recorded' && state.recorded;
  useEffect(() => {
    if (done && done.meetsAge) void navigate(request.next ?? paths.home, { replace: true });
  }, [done, request.next, paths.home, navigate]);

  if (done && !done.meetsAge) {
    return (
      <Stage>
        <div className={styles.hero}>
          <Mascot size={88} mood="sleepy" />
          <h1 className={styles.title} tabIndex={-1} ref={heading}>
            <FormattedMessage id="declaration.restrictedTitle" />
          </h1>
          <p className={styles.lead}>
            <FormattedMessage id="declaration.restrictedBody" values={{ age: done.thresholdAge }} />
          </p>
        </div>
        <Card>
          <div className={styles.form}>
            <p className={styles.notice}>
              <FormattedMessage id="declaration.correction" />
            </p>
            <Button size="lg" block onClick={() => void navigate(paths.home)}>
              <FormattedMessage id="declaration.goHome" />
            </Button>
          </div>
        </Card>
      </Stage>
    );
  }

  const placeError =
    state.error?.kind === 'place-invalid'
      ? intl.formatMessage({ id: 'declaration.error.place' })
      : missed && !country
        ? intl.formatMessage({ id: 'declaration.error.countryRequired' })
        : null;

  const hero = (
    <div className={styles.hero}>
      <Mascot size={88} />
      <h1 className={styles.title} tabIndex={-1} ref={heading}>
        <FormattedMessage id={functionMessageId(request.function)} />
      </h1>
      <p className={styles.lead}>
        <FormattedMessage id="declaration.lead" />
      </p>
    </div>
  );
  const panel = (
    <>
      <Card>
        <form className={styles.form} onSubmit={submit} noValidate>
          <Select
            label={intl.formatMessage({ id: 'declaration.countryLabel' })}
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setSubdivision('');
              setMissed(false);
            }}
            error={placeError}
            hint={intl.formatMessage({ id: 'declaration.countryHint' })}
          >
            <option value="">{intl.formatMessage({ id: 'declaration.choose' })}</option>
            {countries.map((place) => (
              <option key={place.code} value={place.code}>
                {place.name}
              </option>
            ))}
          </Select>
          {subdivisionNeeded && (
            <Select
              label={intl.formatMessage({ id: 'declaration.subdivisionLabel' })}
              value={subdivision}
              onChange={(event) => {
                setSubdivision(event.target.value);
                setMissed(false);
              }}
              error={
                missed && known && !subdivision
                  ? intl.formatMessage({ id: 'declaration.error.subdivisionRequired' })
                  : null
              }
              hint={intl.formatMessage({ id: 'declaration.subdivisionHint' })}
            >
              <option value="">{intl.formatMessage({ id: 'declaration.choose' })}</option>
              {(known ?? []).map((place) => (
                <option key={place.code} value={place.code}>
                  {place.name}
                </option>
              ))}
            </Select>
          )}
          <Checkbox
            label={<FormattedMessage id="declaration.meetsAge" />}
            checked={meetsAge}
            onChange={(event) => {
              setMeetsAge(event.target.checked);
              setMissed(false);
            }}
            hint={intl.formatMessage({ id: 'declaration.meetsAgeHint' })}
            error={
              missed && country && meetsAge === false
                ? intl.formatMessage({ id: 'declaration.error.ageRequired' })
                : null
            }
          />
          <p className={styles.notice}>
            <FormattedMessage id="declaration.correction" />
          </p>
          {state.error && state.error.kind !== 'place-invalid' && (
            <p className={styles.notice} role="alert">
              {declarationErrorText(intl, state.error)}
            </p>
          )}
          <Button type="submit" size="lg" block loading={state.status === 'recording'}>
            <FormattedMessage id="declaration.submit" />
          </Button>
        </form>
      </Card>
      <p className={styles.alternative}>
        <Button variant="ghost" onClick={() => setConfirmingBelow(true)}>
          <FormattedMessage id="declaration.below" />
        </Button>
      </p>
    </>
  );

  // Compact: the mascot above the form. Wide: beside it, so the form stays whole above a keyboard.
  return (
    <>
      {layout === 'wide' ? (
        <SplitStage aside={hero}>{panel}</SplitStage>
      ) : (
        <Stage>
          {hero}
          {panel}
        </Stage>
      )}
      <Dialog
        open={confirmingBelow}
        title={intl.formatMessage({ id: 'declaration.belowTitle' })}
        closeLabel={intl.formatMessage({ id: 'declaration.belowClose' })}
        onClose={() => setConfirmingBelow(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmingBelow(false)}>
              <FormattedMessage id="declaration.belowCancel" />
            </Button>
            <Button onClick={() => record(false)} disabled={!country}>
              <FormattedMessage id="declaration.belowConfirm" />
            </Button>
          </>
        }
      >
        <p className={styles.notice}>
          <FormattedMessage id="declaration.belowBody" />
        </p>
      </Dialog>
    </>
  );
}

// The heading says what asked for the declaration. A function kind this build does not know is
// named by what every one of them has in common.
function functionMessageId(
  marketFunction: DeclarationRequest['function'],
): `declaration.function.${MarketFunction}` | 'declaration.function.unknown' {
  return marketFunction === null
    ? 'declaration.function.unknown'
    : `declaration.function.${marketFunction}`;
}

function declarationErrorText(intl: IntlShape, error: DeclarationError): string {
  switch (error.kind) {
    case 'conflict':
      return intl.formatMessage({ id: 'declaration.error.conflict' });
    case 'place-missing':
      return intl.formatMessage({ id: 'declaration.error.countryRequired' });
    case 'place-invalid':
      return intl.formatMessage({ id: 'declaration.error.place' });
    case 'rate-limited':
      return intl.formatMessage({ id: 'declaration.error.rateLimited' });
    case 'unavailable':
      return intl.formatMessage({ id: 'declaration.error.unavailable' });
  }
}
