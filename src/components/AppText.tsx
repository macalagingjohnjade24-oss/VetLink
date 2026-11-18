import { Text, type TextProps } from 'react-native';
import { typeScale, type TextVariant } from '../theme';

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
  center?: boolean;
};

/** Single typography entry point so every screen uses the VetLink Inter scale. */
export function AppText({ variant = 'body', color, center, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[typeScale[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    />
  );
}
