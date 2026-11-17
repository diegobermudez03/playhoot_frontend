import { joinCodeAlphabet, joinCodeLength, operations } from '@playhoot/protocol';
import { useState, type FormEvent, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useNavigate } from 'react-router';

import type { MessageId } from '../../i18n/catalogs';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, CodeInput, Mascot, Tag } from '../../ui';
import type { Layout } from '../layout';
import { useNavigateToOperation } from '../access';
import { joinPath, newGamePath, teacherPath } from '../paths';
import styles from './HomeScreen.module.css';

/*
 * The public entry (P14§1): a short explanation of what Playhoot is, the join code in reach
 * without signing in, and visible ways to create a game and to teach with it. It renders on the
 * server and works with no account and no JavaScript beyond the code field (D-019).
 *
 * The catalog section is a curated placeholder and says so: Discovery, with its real search and
 * filters over approved content, arrives with its own milestone. Nothing here invents activity
 * or a community that does not exist (P14§2).
 */
export function HomeScreen({ layout }: { layout: Layout }) {
  const intl = useIntl();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  const [code, setCode] = useState('');
  const complete = code.length === joinCodeLength;
  // Teaching is real for an account since H3: the band and the intro both lead to the teacher
  // screen, through the sign-in screen when the account level is still missing.
  const goToOperation = useNavigateToOperation();
  const teach = () => goToOperation(operations.setOwnMode, teacherPath, 'teach');

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (complete) navigate(joinPath(code));
  };

  const intro = (
    <div className={styles.intro}>
      <h1 className={styles.title}>
        <FormattedMessage id="home.title" values={mark} />
      </h1>
      <p className={styles.lead}>
        <FormattedMessage id="home.intro" />
      </p>
      <div className={styles.introActions}>
        <Link className={styles.create} to={newGamePath}>
          <FormattedMessage id="home.create" />
        </Link>
        <button type="button" className={styles.teach} onClick={teach}>
          <FormattedMessage id="home.teach" />
        </button>
      </div>
    </div>
  );

  const joinCard = (
    <Card className={styles.joinCard} tilted>
      <form className={styles.joinForm} onSubmit={join}>
        <h2 className={styles.joinTitle}>
          <FormattedMessage id="home.join.title" />
        </h2>
        <CodeInput
          value={code}
          onChange={setCode}
          length={joinCodeLength}
          alphabet={joinCodeAlphabet}
          label={intl.formatMessage({ id: 'home.join.label' })}
          labelVisible
        />
        <Button type="submit" size="lg" block disabled={!complete}>
          <FormattedMessage id="home.join.submit" />
        </Button>
        <p className={styles.joinNote}>
          <FormattedMessage id="home.join.note" />
        </p>
        <Link className={styles.joinLink} to={paths.enterCode}>
          <FormattedMessage id="home.join.page" />
        </Link>
      </form>
    </Card>
  );

  return (
    <div className={layout === 'wide' ? styles.wide : styles.compact}>
      <section className={styles.hero}>
        {intro}
        <div className={styles.heroAside}>
          <Mascot size={layout === 'wide' ? 150 : 110} animated />
          {joinCard}
        </div>
      </section>

      <Section titleId="home.what.title">
        <ul className={styles.points}>
          {points.map((point) => (
            <Card as="li" key={point.title} className={styles.point} tone="flat">
              <h3 className={styles.pointTitle}>
                <FormattedMessage id={point.title} />
              </h3>
              <p className={styles.pointBody}>
                <FormattedMessage id={point.body} />
              </p>
            </Card>
          ))}
        </ul>
      </Section>

      <Section
        titleId="home.catalog.title"
        aside={<Tag tone="accent">{intl.formatMessage({ id: 'home.catalog.curated' })}</Tag>}
      >
        <p className={styles.sectionLead}>
          <FormattedMessage id="home.catalog.lead" />
        </p>
        <ul className={styles.kinds}>
          {kinds.map((kind) => (
            <Card as="li" key={kind.name} className={styles.kind} tilted>
              <h3 className={styles.kindName}>
                <FormattedMessage id={kind.name} />
              </h3>
              <p className={styles.kindBody}>
                <FormattedMessage id={kind.body} />
              </p>
            </Card>
          ))}
        </ul>
      </Section>

      <Card className={styles.teacherBand} tone="accent">
        <div className={styles.teacherTexts}>
          <h2 className={styles.bandTitle}>
            <FormattedMessage id="home.teacher.title" />
          </h2>
          <p className={styles.bandBody}>
            <FormattedMessage id="home.teacher.body" />
          </p>
        </div>
        <Button variant="secondary" size="lg" onClick={teach}>
          <FormattedMessage id="home.teacher.cta" />
        </Button>
      </Card>
    </div>
  );
}

function Section({
  titleId,
  aside,
  children,
}: {
  titleId: MessageId;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id={titleId} />
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// The word the title underlines, as the direction render marks one word of a sentence.
const mark = {
  mark: (chunks: ReactNode) => <mark className="i18n-mark">{chunks}</mark>,
};

const points: { title: MessageId; body: MessageId }[] = [
  { title: 'home.what.play.title', body: 'home.what.play.body' },
  { title: 'home.what.create.title', body: 'home.what.create.body' },
  { title: 'home.what.teach.title', body: 'home.what.teach.body' },
];

// What kinds of games Playhoot is for. Examples of what can be made, not games that exist and
// not numbers about them: the catalog is Discovery's, and it is not here yet.
const kinds: { name: MessageId; body: MessageId }[] = [
  { name: 'home.catalog.quiz.name', body: 'home.catalog.quiz.body' },
  { name: 'home.catalog.words.name', body: 'home.catalog.words.body' },
  { name: 'home.catalog.board.name', body: 'home.catalog.board.body' },
  { name: 'home.catalog.party.name', body: 'home.catalog.party.body' },
];
