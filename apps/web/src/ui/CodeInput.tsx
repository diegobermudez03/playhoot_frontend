import { useState } from 'react';

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
  autoFocus?: boolean;
}

// Typing goes to a real, transparent input laid over the tiles, so keyboards, paste,
// autofill and screen readers all work as with any text field.
export function CodeInput({ value, onChange, length, alphabet, label, autoFocus }: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const sound = useSound();
  const clean = (raw: string) =>
    [...raw.toUpperCase()]
      .filter((char) => alphabet.includes(char))
      .join('')
      .slice(0, length);

  return (
    <div className={styles.wrap}>
      <CodeTiles
        code={value}
        length={length}
        size="lg"
        activeIndex={focused && value.length < length ? value.length : null}
      />
      <input
        className={styles.input}
        aria-label={label}
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
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="go"
        autoFocus={autoFocus}
      />
    </div>
  );
}
