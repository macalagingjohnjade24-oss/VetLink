import { StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { LinkCard } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SUGGESTED_QUESTIONS } from '../../data/mockAssistant';
import { colors, spacing } from '../../theme';
import type { AIScreenProps } from '../../navigation/types';

/** PO-53 Suggested Questions */
export function AISuggestedQuestionsScreen({ navigation }: AIScreenProps<'AISuggestedQuestions'>) {
  return (
    <Screen safeBottom contentStyle={styles.content}>
      <AppHeader title="Suggested Questions" />

      <AppText variant="display">What can I help with?</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Choose a topic to get started.
      </AppText>

      {SUGGESTED_QUESTIONS.map((item) => (
        <LinkCard
          key={item.id}
          icon="document-text-outline"
          title={item.question}
          caption={item.caption}
          onPress={() => navigation.navigate('AIChat', { question: item.question })}
        />
      ))}

      <Button label="Start a Conversation" onPress={() => navigation.navigate('AIChat')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
});
