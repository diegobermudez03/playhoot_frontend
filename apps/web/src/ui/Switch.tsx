import { useId, type ReactNode } from 'react';

import styles from './Switch.module.css';

interface SwitchProps {
  // What is being turned on or off, as a whole phrase.
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  // The change is being written down: the switch shows what was asked for and waits.
  busy?: boolean;
  className?: string | undefined;
}

// Something that is on or off and takes effect at once (an email group, a preference). It is a
// real switch to the platform — `role="switch"` with its state announced — so a screen reader
// says "on" or "off" and the keyboard works without any code of ours. The state is drawn by the
// knob's position and by the word beside it, never by colour alone (WCAG 1.4.1).
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  busy = false,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        {...(hint ? { 'aria-describedby': `${id}-hint` } : {})}
        className={styles.control}
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.track} aria-hidden="true">
          <span className={styles.knob} />
        </span>
      </button>
      <div className={styles.text}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
