import type { DraftBrief } from '@playhoot/feature-game-authoring';
import { FormattedMessage } from 'react-intl';

import { Card } from '../../ui';
import styles from './GameWorkspace.module.css';

// The phase of the work the brief records, as a chip beside the revision.
export function BriefPhaseChip({ brief }: { brief: DraftBrief }) {
  if (brief.status !== 'valid') return null;
  return (
    <span className={`${styles.badge} ${styles.badgeNeutral}`} data-testid="brief-phase">
      <FormattedMessage id="brief.phase" values={{ phase: brief.phase }} />
    </span>
  );
}

// What the person and their AI agreed (brief.json), read-only: it changes as a file or through
// the AI. Its texts are the person's and their AI's, shown as written.
export function BriefSummary({ brief }: { brief: DraftBrief }) {
  return (
    <Card className={styles.panel} data-testid="brief-summary">
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="brief.title" />
      </h2>
      {brief.status === 'absent' && (
        <p className={styles.muted}>
          <FormattedMessage id="brief.absent" />
        </p>
      )}
      {brief.status === 'invalid' && (
        <p className={styles.warningText}>
          <FormattedMessage id="brief.invalid" />
        </p>
      )}
      {brief.status === 'valid' && (
        <div className={styles.summary}>
          <p>
            <FormattedMessage id="brief.phase" values={{ phase: brief.phase }} />
          </p>
          {brief.brief.players && (
            <p>
              <FormattedMessage
                id="brief.players"
                values={{ min: brief.brief.players.min, max: brief.brief.players.max }}
              />
            </p>
          )}
          <Line id="brief.goal" text={brief.brief.goal} />
          <Line id="brief.rounds" text={brief.brief.rounds} />
          <Line id="brief.scoring" text={brief.brief.scoring} />
          <Line id="brief.ending" text={brief.brief.ending} />
          <List id="brief.private" items={brief.brief.private_information} />
          <List id="brief.openQuestions" items={brief.brief.open_questions} />
        </div>
      )}
    </Card>
  );
}

function Line({
  id,
  text,
}: {
  id: 'brief.goal' | 'brief.rounds' | 'brief.scoring' | 'brief.ending';
  text: string | undefined;
}) {
  if (!text) return null;
  return (
    <p className={styles.editedFile}>
      <strong>
        <FormattedMessage id={id} />
      </strong>
      <span>{text}</span>
    </p>
  );
}

function List({
  id,
  items,
}: {
  id: 'brief.private' | 'brief.openQuestions';
  items: string[] | undefined;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={styles.summaryLine}>
      <strong>
        <FormattedMessage id={id} />
      </strong>
      <ul className={styles.pathList}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
