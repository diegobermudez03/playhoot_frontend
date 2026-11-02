import { createAiLinkSharing, type AiLinkSharing } from '@playhoot/feature-game-authoring';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../../app/ServicesContext';
import { Button, Card } from '../../../ui';
import styles from '../GameWorkspace.module.css';

// "Compartir con mi IA": the game's link for the person's AI chat. Whoever has it reads and
// changes this game for 7 days; one is active at a time, and a new one replaces it. The link is
// shown once, right after it is made, and kept only while this section is open.
export function ShareSection({ gameUUID }: { gameUUID: string }) {
  const services = useServices();
  const [sharing, setSharing] = useState<AiLinkSharing | null>(null);
  useEffect(() => {
    const next = createAiLinkSharing({ games: services.gamesApi, gameUUID });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setSharing(next);
    void next.load();
    return () => next.dispose();
  }, [gameUUID, services]);
  if (!sharing) return null;
  return <SharePanel sharing={sharing} />;
}

type Confirming = 'renew' | 'revoke' | null;

function SharePanel({ sharing }: { sharing: AiLinkSharing }) {
  const intl = useIntl();
  const load = useStore(sharing.store, (state) => state.load);
  const created = useStore(sharing.store, (state) => state.created);
  const busy = useStore(sharing.store, (state) => state.busy);
  const failed = useStore(sharing.store, (state) => state.failed);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [copied, setCopied] = useState<'message' | 'link' | null>(null);

  const active = load.status === 'ready' && load.link.active;
  const expiresAt = created?.expiresAt ?? (load.status === 'ready' ? load.link.expiresAt : null);
  const when = (iso: string) => intl.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' });

  const copy = async (what: 'message' | 'link', url: string) => {
    const text = what === 'link' ? url : intl.formatMessage({ id: 'share.message' }, { url });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard refused: the link stays on screen to copy by hand.
    }
  };

  const create = async () => {
    setConfirming(null);
    await sharing.create();
  };
  const revoke = async () => {
    setConfirming(null);
    await sharing.revoke();
  };

  return (
    <Card className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="share.title" />
      </h2>
      <p className={styles.muted}>
        <FormattedMessage id="share.intro" />
      </p>

      {load.status === 'loading' && (
        <p className={styles.muted}>
          <FormattedMessage id="share.loading" />
        </p>
      )}
      {load.status === 'failed' && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <p>
            <FormattedMessage id="share.loadFailed" />
          </p>
          <div className={styles.noticeActions}>
            <Button variant="secondary" onClick={() => void sharing.load()}>
              <FormattedMessage id="workspace.retry" />
            </Button>
          </div>
        </div>
      )}

      {load.status === 'ready' && (
        <p data-testid="ai-link-status">
          {active && expiresAt ? (
            <FormattedMessage id="share.active" values={{ until: when(expiresAt) }} />
          ) : (
            <FormattedMessage id="share.none" />
          )}
        </p>
      )}

      {created && (
        <div className={styles.summary} data-testid="ai-link-created">
          <span className={styles.summaryTitle}>
            <FormattedMessage id="share.created" />
          </span>
          <input
            className={styles.code}
            readOnly
            value={created.url}
            aria-label={intl.formatMessage({ id: 'share.linkLabel' })}
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className={styles.warningText}>
            <FormattedMessage id="share.warning" values={{ until: when(created.expiresAt) }} />
          </p>
          <div className={styles.rowActions}>
            <Button onClick={() => void copy('message', created.url)}>
              {copied === 'message' ? (
                <FormattedMessage id="share.copied" />
              ) : (
                <FormattedMessage id="share.copyMessage" />
              )}
            </Button>
            <Button variant="secondary" onClick={() => void copy('link', created.url)}>
              {copied === 'link' ? (
                <FormattedMessage id="share.copied" />
              ) : (
                <FormattedMessage id="share.copyLink" />
              )}
            </Button>
            <Button variant="ghost" onClick={sharing.forgetCreated}>
              <FormattedMessage id="share.hide" />
            </Button>
          </div>
        </div>
      )}

      {failed && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <p>
            <FormattedMessage
              id={failed === 'create' ? 'share.createFailed' : 'share.revokeFailed'}
            />
          </p>
        </div>
      )}

      {load.status === 'ready' && confirming === null && (
        <div className={styles.rowActions}>
          <Button
            loading={busy === 'create'}
            disabled={busy !== null}
            onClick={() => (active ? setConfirming('renew') : void create())}
          >
            <FormattedMessage id={active ? 'share.renew' : 'share.create'} />
          </Button>
          {active && (
            <Button
              variant="ghost"
              loading={busy === 'revoke'}
              disabled={busy !== null}
              onClick={() => setConfirming('revoke')}
            >
              <FormattedMessage id="share.revoke" />
            </Button>
          )}
        </div>
      )}

      {confirming !== null && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <p>
            <FormattedMessage
              id={confirming === 'renew' ? 'share.renew.confirm' : 'share.revoke.confirm'}
            />
          </p>
          <div className={styles.noticeActions}>
            <Button
              variant="danger"
              onClick={() => void (confirming === 'renew' ? create() : revoke())}
            >
              <FormattedMessage
                id={confirming === 'renew' ? 'share.renew.yes' : 'share.revoke.yes'}
              />
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              <FormattedMessage id="share.cancel" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
