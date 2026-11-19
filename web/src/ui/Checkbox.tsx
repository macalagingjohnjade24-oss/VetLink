import { useId, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export function Checkbox({ label, id, ...rest }: Props) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <label className="checkbox" htmlFor={inputId}>
      <input {...rest} id={inputId} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
