import { useId, useState, type InputHTMLAttributes } from 'react';
import { Icon } from './Icon';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  error?: string | null;
  hint?: string;
  revealable?: boolean;
};

/** 52px field matching the Figma input; `revealable` adds the password eye. */
export function Input({ label, error, hint, revealable, type = 'text', ...rest }: Props) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const resolvedType = revealable ? (revealed ? 'text' : 'password') : type;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className={`field__control${error ? ' field__control--error' : ''}`}>
        <input
          {...rest}
          id={id}
          type={resolvedType}
          className="field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-message` : undefined}
        />
        {revealable ? (
          <button
            type="button"
            className="field__icon-button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={19} />
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="field__error" id={`${id}-message`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${id}-message`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
