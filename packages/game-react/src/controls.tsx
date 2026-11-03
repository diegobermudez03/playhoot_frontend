// Semantic controls: `activate` (Button), `select` (Choices) and `text` (TextAnswer). Each works
// the same with a mouse, touch, a keyboard and assistive technology (React Aria handles press,
// focus and keyboard navigation), so a game never reads key codes or pointer coordinates.
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  mergeProps,
  useButton,
  useFocusRing,
  useRadio,
  useRadioGroup,
  useTextField,
  VisuallyHidden,
} from 'react-aria';
import { useRadioGroupState, type RadioGroupState } from 'react-stately';

import { toneStyle, type Tone } from './presentation';

const focusRing: CSSProperties = {
  outline: 'calc(var(--ph-gap) / 2) solid var(--ph-color)',
  outlineOffset: 'calc(var(--ph-gap) / 4)',
};

const controlBase: CSSProperties = {
  minHeight: 'var(--ph-target)',
  minWidth: 'var(--ph-target)',
  padding: 'calc(var(--ph-gap) * 0.75) calc(var(--ph-gap) * 1.5)',
  borderRadius: 'var(--ph-radius)',
  border: 'none',
  font: 'inherit',
  cursor: 'pointer',
  transition: 'transform var(--ph-transition), opacity var(--ph-transition)',
  boxSizing: 'border-box',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
};

// Something to activate: a click, a tap, Enter or Space. While a promise `onPress` returned is
// pending the button shows it and ignores more presses.
export function Button({
  children,
  onPress,
  disabled = false,
  tone = 'accent',
  selected = false,
  label,
  style,
}: {
  children: ReactNode;
  onPress(): unknown;
  disabled?: boolean;
  tone?: Tone;
  // Marks the button as the current choice (e.g. a toggle).
  selected?: boolean;
  // The accessible name when the content is not text (an icon).
  label?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const { buttonProps, isPressed } = useButton(
    {
      isDisabled: disabled || pending,
      ...(label !== undefined && { 'aria-label': label }),
      onPress: () => {
        const result = onPress();
        if (result instanceof Promise) {
          setPending(true);
          void result.finally(() => setPending(false));
        }
      },
    },
    ref,
  );
  const { focusProps, isFocusVisible } = useFocusRing();
  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      aria-pressed={selected || undefined}
      aria-busy={pending || undefined}
      style={{
        ...controlBase,
        ...toneStyle(tone),
        ...(isPressed && { transform: 'scale(0.97)' }),
        ...((disabled || pending) && { opacity: 0.55, cursor: 'default' }),
        ...(selected && { boxShadow: 'inset 0 0 0 calc(var(--ph-gap) / 2) var(--ph-color)' }),
        ...(isFocusVisible && focusRing),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// How an option looks after a reveal.
export type ChoiceMark = 'correct' | 'wrong';

// Picking one option (a quiz answer, a vote): `value` is the chosen option's index. Arrow keys move
// between options, Space or a tap picks one. `marks` color options once revealed.
export function Choices({
  options,
  value,
  onChange,
  label,
  disabled = false,
  columns = 2,
  marks,
}: {
  options: readonly ReactNode[];
  value: number | null;
  onChange(index: number): unknown;
  // What is being chosen, for assistive technology ("Your answer").
  label: string;
  disabled?: boolean;
  columns?: number;
  marks?: Readonly<Record<number, ChoiceMark>>;
}) {
  const state = useRadioGroupState({
    value: value === null ? null : String(value),
    onChange: (next) => void onChange(Number(next)),
    isDisabled: disabled,
  });
  const { radioGroupProps } = useRadioGroup({ 'aria-label': label, isDisabled: disabled }, state);
  return (
    <div
      {...radioGroupProps}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 'var(--ph-gap)',
      }}
    >
      {options.map((option, index) => (
        <Choice key={index} index={index} state={state} mark={marks?.[index]}>
          {option}
        </Choice>
      ))}
    </div>
  );
}

function Choice({
  index,
  state,
  mark,
  children,
}: {
  index: number;
  state: RadioGroupState;
  mark: ChoiceMark | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { inputProps, isSelected, isDisabled, isPressed } = useRadio(
    { value: String(index), children },
    state,
    ref,
  );
  const { focusProps, isFocusVisible } = useFocusRing();
  const tone: Tone = mark === 'correct' ? 'positive' : mark === 'wrong' ? 'negative' : 'surface';
  return (
    <label
      style={{
        ...controlBase,
        ...toneStyle(isSelected && mark === undefined ? 'accent' : tone),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        ...(isPressed && { transform: 'scale(0.97)' }),
        ...(isDisabled && { cursor: 'default' }),
        ...(isDisabled && !isSelected && mark === undefined && { opacity: 0.55 }),
        ...(isSelected && { boxShadow: 'inset 0 0 0 calc(var(--ph-gap) / 2) var(--ph-color)' }),
        ...(isFocusVisible && focusRing),
      }}
    >
      <VisuallyHidden>
        <input {...mergeProps(inputProps, focusProps)} ref={ref} />
      </VisuallyHidden>
      {children}
    </label>
  );
}

// Typing an answer and sending it with Enter or the button. It keeps the text when `onSubmit`
// answers `{ ok: false }` (or throws), and clears it otherwise.
export function TextAnswer({
  label,
  onSubmit,
  submitLabel = 'Send',
  placeholder,
  maxLength = 120,
  disabled = false,
}: {
  label: string;
  onSubmit(text: string): unknown;
  submitLabel?: ReactNode;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const submit = async () => {
    const value = text.trim();
    if (value === '' || disabled) return;
    try {
      const result = (await onSubmit(value)) as { ok?: boolean } | undefined;
      if (result?.ok !== false) setText('');
    } catch {
      // Kept for another try.
    }
  };
  const { labelProps, inputProps } = useTextField(
    {
      label,
      value: text,
      onChange: setText,
      ...(placeholder !== undefined && { placeholder }),
      maxLength,
      isDisabled: disabled,
      onKeyDown: (event) => {
        if (event.key === 'Enter') void submit();
        else event.continuePropagation();
      },
    },
    ref,
  );
  const { focusProps, isFocusVisible } = useFocusRing({ isTextInput: true });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--ph-gap) / 2)' }}>
      <label {...labelProps} style={{ color: 'var(--ph-muted)' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 'var(--ph-gap)' }}>
        <input
          {...mergeProps(inputProps, focusProps)}
          ref={ref}
          style={{
            ...controlBase,
            ...toneStyle('surface'),
            flex: 1,
            cursor: 'text',
            userSelect: 'text',
            ...(isFocusVisible && focusRing),
          }}
        />
        <Button onPress={submit} disabled={disabled || text.trim() === ''}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
