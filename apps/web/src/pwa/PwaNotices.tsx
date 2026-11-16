import { FormattedMessage, useIntl } from 'react-intl';

import { usePwa } from './PwaContext';
import styles from './PwaNotices.module.css';

// The two things the browser may have to say about the installed app, in the corner of the page.
// Neither is a dialog: nothing is covered, focus is not taken or trapped, and either one can be
// dismissed with the keyboard (P01§5, WCAG 2.2 AA). The update comes first when both are due,
// because it is the one with a consequence.
export function PwaNotices() {
  const pwa = usePwa();
  if (!pwa) return null;
  if (pwa.updateWaiting) return <UpdateNotice />;
  if (pwa.hintDue) return <InstallHint />;
  return null;
}

function UpdateNotice() {
  const pwa = usePwa();
  const intl = useIntl();
  if (!pwa) return null;
  return (
    <div className={styles.notice} role="status">
      <p className={styles.title}>
        <FormattedMessage id="pwa.update.title" />
      </p>
      <p className={styles.body}>
        <FormattedMessage id="pwa.update.body" />
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.accept} onClick={pwa.applyUpdate}>
          <FormattedMessage id="pwa.update.refresh" />
        </button>
        {/* Dismissing changes nothing: the new build takes over on the next navigation anyway. */}
        <button
          type="button"
          className={styles.decline}
          onClick={pwa.dismissUpdate}
          aria-label={intl.formatMessage({ id: 'pwa.update.later' })}
        >
          <FormattedMessage id="pwa.update.later" />
        </button>
      </div>
    </div>
  );
}

// Shown once, to someone who has come back on another day, and never again after they answer
// (V-08). Installing stays available from the shell menu either way.
function InstallHint() {
  const pwa = usePwa();
  const intl = useIntl();
  if (!pwa) return null;
  return (
    <div className={styles.notice} role="status">
      <p className={styles.title}>
        <FormattedMessage id="pwa.hint.title" />
      </p>
      <p className={styles.body}>
        <FormattedMessage id="pwa.hint.body" />
      </p>
      {pwa.install === 'instructions' ? (
        <>
          <p className={styles.body}>
            <FormattedMessage id="pwa.hint.appleSteps" />
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.accept}
              onClick={pwa.settleHint}
              aria-label={intl.formatMessage({ id: 'pwa.hint.close' })}
            >
              <FormattedMessage id="pwa.hint.close" />
            </button>
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.accept}
            onClick={() => {
              pwa.settleHint();
              pwa.promptInstall();
            }}
          >
            <FormattedMessage id="pwa.hint.install" />
          </button>
          <button
            type="button"
            className={styles.decline}
            onClick={pwa.settleHint}
            aria-label={intl.formatMessage({ id: 'pwa.hint.dismiss' })}
          >
            <FormattedMessage id="pwa.hint.dismiss" />
          </button>
        </div>
      )}
    </div>
  );
}
