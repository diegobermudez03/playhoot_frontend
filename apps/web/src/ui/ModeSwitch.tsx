import styles from './ModeSwitch.module.css';

interface ModeSwitchProps<T extends string> {
  // What the whole control is for, for people who do not see it grouped.
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // `sm` is the tighter one, for a control that shares a line with others (the top bar).
  size?: 'sm' | 'md';
  className?: string | undefined;
}

/*
 * The segmented control: a small, closed set of alternatives where exactly one
 * is chosen (the 3-mode switch of the top bar, an orientation, a filter).
 *
 * It is a radio group, not tabs: nothing is revealed or hidden by it, so arrow
 * keys and Tab behave the way a person expects from a group of choices. Tabs
 * that swap panels are a different component and will arrive with the screen
 * that needs them.
 */
export function ModeSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: ModeSwitchProps<T>) {
  return (
    <div
      className={[styles.switch, styles[size], className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={[styles.option, option.value === value && styles.on].filter(Boolean).join(' ')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
