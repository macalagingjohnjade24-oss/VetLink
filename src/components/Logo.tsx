import { Image, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  tint?: string;
};

const pawSize = { sm: 24, md: 34, lg: 44 } as const;
const wordSize = { sm: 20, md: 28, lg: 34 } as const;

/** VetLink paw mark + wordmark, recreated from the Figma brand component. */
export function Logo({ size = 'md', showWordmark = true, tint }: Props) {
  return (
    <View style={styles.row}>
      <Image source={require('../../assets/paw.png')} style={{ width: pawSize[size], height: pawSize[size] }} resizeMode="contain" />
      {showWordmark ? (
        <AppText
          style={[
            styles.wordmark,
            { fontSize: wordSize[size], lineHeight: wordSize[size] * 1.2, color: tint ?? colors.text.brand },
          ]}
        >
          VetLink
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
});
