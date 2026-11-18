import type { TextStyle } from 'react-native';
import { colors } from './colors';

/** Inter is the only typeface used in the VetLink Figma file. */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type TextVariant =
  | 'display'
  | 'screenTitle'
  | 'title'
  | 'cardTitle'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'small'
  | 'badge'
  | 'link';

export const typeScale: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, color: colors.text.brand },
  screenTitle: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 28, color: colors.text.brand },
  title: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 22, color: colors.text.primary },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21, color: colors.text.primary },
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.text.primary },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.text.brand },
  label: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: colors.text.secondary },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 18, color: colors.text.secondary },
  small: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 16, color: colors.text.secondary },
  badge: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 16 },
  link: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.text.brand },
};
