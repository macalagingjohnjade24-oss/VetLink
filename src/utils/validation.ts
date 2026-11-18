export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export const isMobileNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return /^[+()\d\s-]+$/.test(value.trim()) && digits.length >= 7 && digits.length <= 15;
};

export const passwordChecks = (value: string) => ({
  length: value.length >= 8,
  uppercase: /[A-Z]/.test(value),
  number: /\d/.test(value),
});

export const isStrongPassword = (value: string) => Object.values(passwordChecks(value)).every(Boolean);

export const passwordHint = 'Use at least 8 characters, with one uppercase letter and one number.';

/** Human readable label for a form error summary. */
export const requireField = (value: string, label: string) =>
  value.trim().length === 0 ? `${label} is required.` : null;
