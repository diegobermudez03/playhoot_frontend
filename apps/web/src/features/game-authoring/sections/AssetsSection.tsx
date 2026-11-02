import type { DraftAsset } from '@playhoot/communication';
import type { GameAuthoring } from '@playhoot/feature-game-authoring';
import { assetStatuses } from '@playhoot/protocol';
import { useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { useStore } from 'zustand';

import { Button, Card } from '../../../ui';
import { ActionResultNotice } from '../ActionResultNotice';
import { DiagnosticList } from '../DiagnosticList';
import styles from '../GameWorkspace.module.css';

// What the file picker offers for each declared type; the backend still reads the real type.
const accepted: Record<string, string> = {
  image: 'image/png,image/webp,image/jpeg,image/svg+xml',
  audio: 'audio/mpeg,audio/ogg,audio/wav',
  video: 'video/mp4,video/webm',
};

// "Recursos": the assets game.project.json declares, with what is missing, ready, or bound to a
// key no longer declared; upload, replace and remove them.
export function AssetsSection({ authoring }: { authoring: GameAuthoring }) {
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const result = useStore(authoring.store, (state) => state.result);
  const shown = result && (result.action === 'upload' || result.action === 'remove');

  return (
    <Card className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="assets.title" />
      </h2>
      {draft.assetDiagnostics.length > 0 && (
        <div className={styles.noticeError + ' ' + styles.notice}>
          <p>
            <FormattedMessage id="assets.declarationError" />
          </p>
          <DiagnosticList
            items={draft.assetDiagnostics.map((diagnostic) => ({
              where: diagnostic.path,
              code: diagnostic.code,
              message: diagnostic.message,
            }))}
          />
        </div>
      )}
      {draft.assets.length === 0 ? (
        <p className={styles.muted}>
          <FormattedMessage id="assets.none" />
        </p>
      ) : (
        <ul className={styles.list} data-testid="assets">
          {draft.assets.map((asset) => (
            <AssetRow key={asset.key} asset={asset} authoring={authoring} />
          ))}
        </ul>
      )}
      {shown && <ActionResultNotice result={result} authoring={authoring} />}
    </Card>
  );
}

function AssetRow({ asset, authoring }: { asset: DraftAsset; authoring: GameAuthoring }) {
  const busy = useStore(authoring.store, (state) => state.busy);
  const picker = useRef<HTMLInputElement>(null);
  const ready = asset.status === assetStatuses.ready;
  const declared = asset.status !== assetStatuses.undeclared;
  const tone = ready ? styles.badgeOk : declared ? styles.badgeError : styles.badgeNeutral;

  return (
    <li className={styles.listItem} data-testid={`asset-${asset.key}`} data-status={asset.status}>
      <div className={styles.listRow}>
        <code className={styles.assetKey}>{asset.key}</code>
        <span className={styles.muted}>
          <FormattedMessage id="assets.type" values={{ type: asset.type }} />
        </span>
        {asset.optional && (
          <span className={styles.muted}>
            <FormattedMessage id="assets.optional" />
          </span>
        )}
        <span className={`${styles.badge} ${tone}`}>
          <FormattedMessage id="assets.status" values={{ status: asset.status }} />
        </span>
      </div>
      {asset.description && <p className={styles.muted}>{asset.description}</p>}
      {ready && asset.url && <AssetPreview asset={asset} />}
      <div className={styles.rowActions}>
        {declared && (
          <>
            <input
              ref={picker}
              type="file"
              hidden
              accept={accepted[asset.type]}
              data-testid={`asset-input-${asset.key}`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void authoring.uploadAsset(asset.key, file);
              }}
            />
            <Button
              size="md"
              variant={ready ? 'secondary' : 'primary'}
              disabled={busy !== null}
              loading={busy === 'upload'}
              onClick={() => picker.current?.click()}
            >
              <FormattedMessage id={ready ? 'assets.replace' : 'assets.upload'} />
            </Button>
          </>
        )}
        {asset.sha256 && (
          <Button
            size="md"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void authoring.removeAsset(asset.key)}
          >
            <FormattedMessage id="assets.remove" />
          </Button>
        )}
      </div>
    </li>
  );
}

function AssetPreview({ asset }: { asset: DraftAsset }) {
  if (asset.type === 'image') {
    return <img className={styles.assetPreview} src={asset.url!} alt={asset.key} />;
  }
  if (asset.type === 'audio') return <audio controls src={asset.url!} />;
  if (asset.type === 'video') {
    return <video className={styles.assetPreview} controls src={asset.url!} />;
  }
  return null;
}
