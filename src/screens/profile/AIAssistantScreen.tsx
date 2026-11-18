import { StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { Button } from '../../components/Button';
import { LinkCard } from '../../components/Card';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { INTRO_FEATURES, SUGGESTED_QUESTIONS } from '../../data/mockAssistant';
import { colors, spacing } from '../../theme';
import type { AIScreenProps } from '../../navigation/types';

/** PO-51 AI Assistant Introduction */
export function AIAssistantScreen({ navigation }: AIScreenProps<'AIAssistant'>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="AI Assistant Introduction" />

      <AppText variant="display">
        A little guidance,{'\n'}whenever you need it
      </AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Meet the VetLink AI Assistant.
      </AppText>

      <HelpNote title="Helpful information">
        I can help you find clinics, navigate VetLink, and prepare an inquiry for clinic staff.
      </HelpNote>

      <AppText variant="title">Try asking</AppText>

      {INTRO_FEATURES.map((feature) => {
        const item = SUGGESTED_QUESTIONS.find((question) => question.id === feature.questionId);
        if (!item) return null;
        return (
          <LinkCard
            key={item.id}
            icon="document-text-outline"
            title={item.question}
            caption={feature.caption}
            onPress={() => navigation.navigate('AIChat', { question: item.question })}
          />
        );
      })}

      <LinkButton
        label="Explore all suggested questions"
        icon="help-circle-outline"
        onPress={() => navigation.navigate('AISuggestedQuestions')}
      />

      <Button label="Start Conversation" onPress={() => navigation.navigate('AIChat')} />

      <HelpNote>
        AI is not a veterinarian and cannot diagnose or prescribe. For urgent concerns, contact a veterinary clinic
        directly.
      </HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
});
