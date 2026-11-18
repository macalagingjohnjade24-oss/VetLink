/** Spacing / radius / shadow tokens. The Figma mobile frames use a 20px gutter. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  gutter: 20,
} as const;

export const radii = {
  sm: 6,
  input: 10,
  button: 14,
  card: 16,
  sheet: 20,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#1F2937',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#1F2937',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
