import { useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useSound } from './SoundContext';
import styles from './SoundToggle.module.css';

export function SoundToggle() {
  const sound = useSound();
  const muted = useStore(sound.store, (state) => state.muted);
  const intl = useIntl();
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={!muted}
      aria-label={intl.formatMessage({ id: muted ? 'sound.unmute' : 'sound.mute' })}
      onClick={() => {
        sound.setMuted(!muted);
        if (muted) sound.play('tap');
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path className={styles.speaker} d="M4 9h4l5-4v14l-5-4H4z" />
        {muted ? (
          <path className={styles.wave} d="M17 9l5 6M22 9l-5 6" />
        ) : (
          <>
            <path className={styles.wave} d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path className={styles.wave} d="M19 6a8.5 8.5 0 0 1 0 12" />
          </>
        )}
      </svg>
    </button>
  );
}
