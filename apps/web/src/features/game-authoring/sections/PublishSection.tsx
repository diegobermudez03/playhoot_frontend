import type { CardImage, Draft, GameCard, PublishBlocker } from '@playhoot/communication';
import type { GamePublishing } from '@playhoot/feature-game-authoring';
import { buildStatuses, cardLimits, gameVisibilities, publishBlockers } from '@playhoot/protocol';
import { useRef, useState, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import { languageNames, type MessageId } from '../../../i18n/catalogs';
import { Button, Card, TextField } from '../../../ui';
import { BuildStatusBadge } from '../BuildStatusBadge';
import styles from '../GameWorkspace.module.css';
import { newSessionPathFor } from '../../paths';

const imageTypes = 'image/png,image/jpeg,image/webp';

// "Ficha y publicación": the game's card and its publication. Publishing takes only the draft's
// current revision; a published game without an open edition is changed by opening a new one.
export function PublishSection({
  publishing,
  draft,
  onOpenSection,
  onEditionOpened,
  onPublished,
}: {
  publishing: GamePublishing;
  // The open edition's draft, or null when none is open.
  draft: Draft | null;
  onOpenSection: (section: 'build' | 'assets') => void;
  onEditionOpened: () => void;
  onPublished: () => void;
}) {
  const load = useStore(publishing.store, (state) => state.load);
  if (load.status === 'loading') {
    return (
      <Card className={styles.panel}>
        <p className={styles.muted}>
          <FormattedMessage id="publish.loading" />
        </p>
      </Card>
    );
  }
  if (load.status === 'failed') {
    return (
      <Card className={styles.panel}>
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <p>
            <FormattedMessage id="publish.loadFailed" />
          </p>
          <div className={styles.noticeActions}>
            <Button variant="secondary" onClick={() => void publishing.load()}>
              <FormattedMessage id="workspace.retry" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <div className={styles.sectionStack}>
      <CardPanel publishing={publishing} card={load.card} />
      <PublicationPanel
        publishing={publishing}
        card={load.card}
        draft={draft}
        onOpenSection={onOpenSection}
        onEditionOpened={onEditionOpened}
        onPublished={onPublished}
      />
    </div>
  );
}

function CardPanel({ publishing, card }: { publishing: GamePublishing; card: GameCard }) {
  const intl = useIntl();
  const busy = useStore(publishing.store, (state) => state.busy);
  const notice = useStore(publishing.store, (state) => state.notice);
  const [name, setName] = useState(card.name);
  const [description, setDescription] = useState(card.description);
  const logoPicker = useRef<HTMLInputElement>(null);
  const photoPicker = useRef<HTMLInputElement>(null);

  const changed: { name?: string; description?: string } = {};
  if (name.trim() !== card.name) changed.name = name.trim();
  if (description !== card.description) changed.description = description;
  const nameInvalid = name.trim() === '' || [...name.trim()].length > cardLimits.nameMax;

  return (
    <Card className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="publish.card.title" />
      </h2>
      <p className={styles.muted}>
        <FormattedMessage id="publish.card.intro" />
      </p>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!nameInvalid && Object.keys(changed).length > 0) void publishing.save(changed);
        }}
      >
        <TextField
          label={intl.formatMessage({ id: 'publish.card.name' })}
          value={name}
          maxLength={cardLimits.nameMax}
          onChange={(event) => setName(event.target.value)}
          error={
            nameInvalid
              ? intl.formatMessage({ id: 'createGame.nameInvalid' }, { max: cardLimits.nameMax })
              : null
          }
          data-testid="card-name"
        />
        <label className={styles.fieldLabel} htmlFor="card-description">
          <FormattedMessage id="publish.card.description" />
        </label>
        <textarea
          id="card-description"
          className={`${styles.code} ${styles.textArea}`}
          value={description}
          maxLength={cardLimits.descriptionMax}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className={styles.rowActions}>
          <Button
            type="submit"
            disabled={busy !== null || nameInvalid || Object.keys(changed).length === 0}
            loading={busy === 'save'}
          >
            <FormattedMessage id="publish.card.save" />
          </Button>
        </div>
      </form>

      <h3 className={styles.subTitle}>
        <FormattedMessage id="publish.card.logo" />
      </h3>
      {card.logo ? (
        <CardImageView image={card.logo} alt={intl.formatMessage({ id: 'publish.card.logo' })} />
      ) : (
        <p className={styles.muted}>
          <FormattedMessage id="publish.card.noLogo" />
        </p>
      )}
      <div className={styles.rowActions}>
        <input
          ref={logoPicker}
          type="file"
          hidden
          accept={imageTypes}
          data-testid="logo-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void publishing.uploadLogo(file);
          }}
        />
        <Button
          variant="secondary"
          disabled={busy !== null}
          loading={busy === 'logo'}
          onClick={() => logoPicker.current?.click()}
        >
          <FormattedMessage
            id={card.logo ? 'publish.card.replaceLogo' : 'publish.card.uploadLogo'}
          />
        </Button>
        {card.logo && (
          <Button
            variant="ghost"
            disabled={busy !== null}
            loading={busy === 'remove-logo'}
            onClick={() => void publishing.removeLogo()}
          >
            <FormattedMessage id="publish.card.remove" />
          </Button>
        )}
      </div>

      <h3 className={styles.subTitle}>
        <FormattedMessage id="publish.card.photos" />
      </h3>
      <p className={styles.muted}>
        <FormattedMessage id="publish.card.photosHint" values={{ max: cardLimits.photosMax }} />
      </p>
      {card.photos.length > 0 && (
        <div className={styles.photoGrid}>
          {card.photos.map((photo) => (
            <div key={photo.uuid} className={styles.photo}>
              <CardImageView
                image={photo}
                alt={intl.formatMessage({ id: 'publish.card.photos' })}
              />
              <Button
                variant="ghost"
                size="md"
                disabled={busy !== null}
                onClick={() => void publishing.removePhoto(photo.uuid)}
              >
                <FormattedMessage id="publish.card.remove" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {card.photos.length < cardLimits.photosMax && (
        <div className={styles.rowActions}>
          <input
            ref={photoPicker}
            type="file"
            hidden
            accept={imageTypes}
            data-testid="photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void publishing.uploadPhoto(file);
            }}
          />
          <Button
            variant="secondary"
            disabled={busy !== null}
            loading={busy === 'photo'}
            onClick={() => photoPicker.current?.click()}
          >
            <FormattedMessage id="publish.card.addPhoto" />
          </Button>
        </div>
      )}

      {notice?.kind === 'saved' && (
        <div className={`${styles.notice} ${styles.noticeOk}`}>
          <p>
            <FormattedMessage id="publish.card.saved" />
          </p>
        </div>
      )}
      {notice?.kind === 'failed' && notice.action !== 'publish' && notice.action !== 'edition' && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          <p>
            <FormattedMessage id={cardFailureText(notice.failure.kind)} />
          </p>
        </div>
      )}
    </Card>
  );
}

function CardImageView({ image, alt }: { image: CardImage; alt: string }) {
  if (!image.url) return null;
  return <img className={styles.assetPreview} src={image.url} alt={alt} />;
}

function cardFailureText(kind: string): MessageId {
  switch (kind) {
    case 'invalid-card':
      return 'publish.card.failed.invalid';
    case 'too-large':
      return 'publish.card.failed.tooLarge';
    case 'too-many-photos':
      return 'publish.card.failed.tooManyPhotos';
    default:
      return 'publish.card.failed.other';
  }
}

function PublicationPanel({
  publishing,
  card,
  draft,
  onOpenSection,
  onEditionOpened,
  onPublished,
}: {
  publishing: GamePublishing;
  card: GameCard;
  draft: Draft | null;
  onOpenSection: (section: 'build' | 'assets') => void;
  onEditionOpened: () => void;
  onPublished: () => void;
}) {
  const intl = useIntl();
  const busy = useStore(publishing.store, (state) => state.busy);
  const notice = useStore(publishing.store, (state) => state.notice);
  const [visibility, setVisibility] = useState<string>(
    card.published ? card.visibility : gameVisibilities.private,
  );
  const [name, setName] = useState(card.name);
  const when = (iso: string) => intl.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' });
  const visibilityLabel = (value: string) =>
    intl.formatMessage({
      id:
        value === gameVisibilities.public
          ? 'publish.visibility.public'
          : 'publish.visibility.private',
    });

  const publishedState = card.published && card.publishedAt && (
    <div className={styles.summary} data-testid="published-state">
      <span className={styles.summaryTitle}>
        <FormattedMessage
          id="publish.published"
          values={{ when: when(card.publishedAt), visibility: visibilityLabel(card.visibility) }}
        />
      </span>
      {card.live && (
        <span data-testid="live-release">
          <FormattedMessage
            id="publish.live"
            values={{ revision: card.live.revision, sequence: card.live.releaseSequence }}
          />
        </span>
      )}
      {card.live && card.live.languages.length > 0 && (
        <span data-testid="live-languages">
          <FormattedMessage
            id="publish.languages"
            values={{ languages: card.live.languages.map(languageName).join(', ') }}
          />
        </span>
      )}
      <div className={styles.rowActions}>
        <Link to={newSessionPathFor(card.gameUUID)}>
          <FormattedMessage id="publish.createSession" />
        </Link>
      </div>
    </div>
  );

  const failure =
    notice?.kind === 'failed' && (notice.action === 'publish' || notice.action === 'edition')
      ? notice.failure
      : null;

  if (!card.editing && !card.publishing) {
    return (
      <Card className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="publish.title" />
        </h2>
        {publishedState}
        <p className={styles.muted}>
          <FormattedMessage id="publish.newVersion.intro" />
        </p>
        <div className={styles.rowActions}>
          <Button
            disabled={busy !== null}
            loading={busy === 'edition'}
            onClick={() =>
              void publishing.openEdition().then((opened) => opened && onEditionOpened())
            }
          >
            <FormattedMessage id="publish.newVersion" />
          </Button>
        </div>
        {failure && (
          <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <p>
              <FormattedMessage id="publish.failed.other" />
            </p>
          </div>
        )}
        {notice?.kind === 'published' && (
          <div className={`${styles.notice} ${styles.noticeOk}`}>
            <p>
              <FormattedMessage
                id="publish.done"
                values={{ revision: notice.publication.revision }}
              />
            </p>
          </div>
        )}
      </Card>
    );
  }

  const buildStatus = draft?.build?.status ?? null;
  const nameTrimmed = name.trim();
  const nameInvalid = nameTrimmed === '' || [...nameTrimmed].length > cardLimits.nameMax;

  return (
    <Card className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="publish.title" />
      </h2>
      {publishedState}
      {card.published && (
        <p className={styles.muted}>
          <FormattedMessage id="publish.editionNote" />
        </p>
      )}
      {card.publishing && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <p>
            <FormattedMessage id="publish.underWay" />
          </p>
        </div>
      )}
      {draft && (
        <p className={styles.summaryLine} data-testid="publish-revision">
          <FormattedMessage id="publish.revision" values={{ revision: draft.currentRevision }} />
          <BuildStatusBadge status={buildStatus} />
        </p>
      )}
      <TextField
        label={intl.formatMessage({ id: 'publish.confirmName' })}
        value={name}
        maxLength={cardLimits.nameMax}
        onChange={(event) => setName(event.target.value)}
        error={
          nameInvalid
            ? intl.formatMessage({ id: 'createGame.nameInvalid' }, { max: cardLimits.nameMax })
            : null
        }
        data-testid="publish-name"
      />
      <fieldset className={styles.choices}>
        <legend className={styles.fieldLabel}>
          <FormattedMessage id="publish.visibility" />
        </legend>
        {[gameVisibilities.private, gameVisibilities.public].map((value) => (
          <label
            key={value}
            className={[styles.choice, visibility === value && styles.choiceSelected]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="radio"
              name="visibility"
              value={value}
              checked={visibility === value}
              onChange={() => setVisibility(value)}
              data-testid={`visibility-${value}`}
            />
            <span>
              <strong>{visibilityLabel(value)}</strong>
              <br />
              <span className={styles.muted}>
                <FormattedMessage
                  id={
                    value === gameVisibilities.public
                      ? 'publish.visibility.public.hint'
                      : 'publish.visibility.private.hint'
                  }
                />
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className={styles.rowActions}>
        <Button
          size="lg"
          disabled={busy !== null || nameInvalid}
          loading={busy === 'publish'}
          onClick={() =>
            void publishing
              .publish({
                visibility,
                ...(nameTrimmed !== card.name && { name: nameTrimmed }),
              })
              .then((published) => published && onPublished())
          }
          data-testid="publish-button"
        >
          <FormattedMessage id="publish.button" />
        </Button>
      </div>
      {buildStatus !== buildStatuses.succeeded && draft && (
        <p className={styles.muted}>
          <FormattedMessage id="publish.buildHint" />
        </p>
      )}
      {notice?.kind === 'not-ready' && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          <p>
            <FormattedMessage id="publish.notReady" />
          </p>
          <ul>
            {notice.blockers.map((blocker) => (
              <li key={blocker.code}>
                <BlockerText blocker={blocker} onOpenSection={onOpenSection} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {failure && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          <p>
            <FormattedMessage
              id={
                failure.kind === 'not-editable'
                  ? 'publish.failed.notEditable'
                  : failure.kind === 'invalid-card'
                    ? 'publish.card.failed.invalid'
                    : 'publish.failed.other'
              }
            />
          </p>
        </div>
      )}
    </Card>
  );
}

function BlockerText({
  blocker,
  onOpenSection,
}: {
  blocker: PublishBlocker;
  onOpenSection: (section: 'build' | 'assets') => void;
}) {
  const go = (section: 'build' | 'assets', label: MessageId): ReactNode => (
    <Button variant="ghost" size="md" onClick={() => onOpenSection(section)}>
      <FormattedMessage id={label} />
    </Button>
  );
  switch (blocker.code) {
    case publishBlockers.buildNotSucceeded:
    case publishBlockers.buildNotForCurrentRevision:
      return (
        <>
          <FormattedMessage id="publish.blocker.build" /> {go('build', 'publish.openBuild')}
        </>
      );
    case publishBlockers.missingRequiredAssets:
      return (
        <>
          <FormattedMessage
            id="publish.blocker.assets"
            values={{ keys: blocker.keys.join(', ') }}
          />{' '}
          {go('assets', 'publish.openAssets')}
        </>
      );
    case publishBlockers.nameRequired:
    case publishBlockers.invalidName:
      return <FormattedMessage id="publish.blocker.name" />;
    case publishBlockers.revisionChanged:
      return <FormattedMessage id="publish.blocker.revisionChanged" />;
    default:
      return <FormattedMessage id="publish.blocker.other" values={{ code: blocker.code }} />;
  }
}

// A language's own name ("Español") for a tag the backend sends; an unknown tag shows as is.
function languageName(tag: string): string {
  return (languageNames as Record<string, string>)[tag] ?? tag;
}
