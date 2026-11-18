/**
 * VetLink colour tokens.
 * Values are taken directly from the VetLink Figma file (page 13:3730) rather than
 * eyeballed, so components match the design exactly.
 */
export const colors = {
  brand: {
    primary: '#720B0B',
    primaryPressed: '#5A0808',
    secondary: '#8E2026',
    peach: '#F4C5B9',
    peachPressed: '#E9B4A6',
    accent: '#FF6B00',
  },
  surface: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    tint: '#FCF0EB',
    tintAlt: '#FAF0EB',
    subtle: '#F8FAFC',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    disabled: '#F1F5F9',
  },
  text: {
    primary: '#1F2937',
    secondary: '#64748B',
    brand: '#720B0B',
    inverse: '#FFFFFF',
    subtle: '#B3B9C2',
  },
  status: {
    success: '#196B36',
    successBg: '#EAF6EE',
    warning: '#87500D',
    warningBg: '#FFF1DF',
    danger: '#AC2727',
    dangerBg: '#FCECEC',
    info: '#3185D6',
    infoBg: '#EAF2FB',
    neutral: '#64748B',
    neutralBg: '#F1F5F9',
  },
  overlay: 'rgba(31, 41, 55, 0.45)',
} as const;
