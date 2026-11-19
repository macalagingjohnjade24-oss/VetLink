import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  length?: number;
};

/** Six single-digit boxes (AUTH-04) with paste and backspace handling. */
export function CodeInput({ value, onChange, disabled, length = 6 }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const setDigit = (index: number, digit: string) => {
    const next = digits.map((current, position) => (position === index ? digit : current)).join('');
    onChange(next.replace(/\s/g, ''));
  };

  return (
    <div className="code-input">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          className="code-input__box"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Verification digit ${index + 1}`}
          value={digit.trim()}
          onChange={(event) => {
            const entered = event.target.value.replace(/\D/g, '');
            if (!entered) {
              setDigit(index, ' ');
              return;
            }
            if (entered.length > 1) {
              const spread = entered.slice(0, length - index).split('');
              const next = digits.map((current, position) => spread[position - index] ?? current).join('');
              onChange(next.replace(/\s/g, ''));
              refs.current[Math.min(index + spread.length, length - 1)]?.focus();
              return;
            }
            setDigit(index, entered);
            if (index < length - 1) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digit.trim() && index > 0) {
              event.preventDefault();
              setDigit(index - 1, ' ');
              refs.current[index - 1]?.focus();
            }
            if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
            if (event.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
            if (!pasted) return;
            event.preventDefault();
            onChange(pasted.slice(0, length));
            refs.current[Math.min(pasted.length, length - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}
