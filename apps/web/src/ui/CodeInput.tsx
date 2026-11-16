import { useId, useState } from 'react';

import styles from './CodeInput.module.css';
import { useSound } from '../sound';
import { CodeTiles } from './CodeTiles';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length: number;
  // Characters accepted; anything else is dropped as the person types or pastes.
  alphabet: string;
  label: string;
  // Draws the label above the tiles instead of only naming the field for a screen reader. A
  // screen whose code field is one task among several shows it (WCAG 2.2 3.3.2).
  labelVisible?: boolean;
  autoFocus?: boolean;
  // What the field is for, so the browser can fill it (WCAG 2.2 1.3.5): a join code is `off`, a
  // one-time code from an authenticator or an email is `one-time-code`.
  autoComplete?: 'off' | 'one-time-code';
  // `numeric` for a field of digits only, so a phone shows the number pad.
  inputMode?: 'text' | 'numeric';
  // What is wrong with what was typed. Announced and tied to the field, so a screen reader
  // reads it as part of the field rather than as a loose line on the page.
  error?: string | null;
  // One line under the tiles while nothing is wrong.
  hint?: string;
}

// Typing goes to a real, transparent input laid over the tiles, so keyboards, paste,
// autofill and screen readers all work as with any text field.
export function CodeInput({
  value,
  onChange,
  length,
  alphabet,
  label,
  labelVisible = false,
  autoFocus,
  autoComplete = 'off',
  inputMode = 'text',
  error = null,
  hint,
}: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  const sound = useSound();
  const clean = (raw: string) =>
    [...raw.toUpperCase()]
      .filter((char) => alphabet.includes(char))
      .join('')
      .slice(0, length);

  return (
    <div className={styles.wrap}>
      {labelVisible && (
        <span className={styles.label} id={labelId}>
          {label}
        </span>
      )}
      <div className={styles.field}>
        <CodeTiles
          code={value}
          length={length}
          size="lg"
          activeIndex={focused && value.length < length ? value.length : null}
        />
        <input
          className={styles.input}
          {...(labelVisible ? { 'aria-labelledby': labelId } : { 'aria-label': label })}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(event) => {
            const next = clean(event.target.value);
            if (next.length > value.length) sound.play('key');
            else if (next.length < value.length) sound.play('erase');
            onChange(next);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={length}
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode={inputMode}
          enterKeyHint="go"
          autoFocus={autoFocus}
        />
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${fieldId}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
