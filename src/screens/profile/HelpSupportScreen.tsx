import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { SearchField } from '../../components/SearchField';
import { useAuth } from '../../context/AuthContext';
import { findFaqs, SUPPORT_EMAIL } from '../../data/mockSupport';
import { supportService, type SupportInquiry } from '../../services/supportService';
import { colors, radii, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

/** PO-61 Help and Support */
export function HelpSupportScreen({ navigation }: ProfileScreenProps<'HelpSupport'>) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [inquiry, setInquiry] = useState<SupportInquiry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const faqs = findFaqs(query);

  const submit = async () => {
    if (!user) return;
    setSending(true);
    setError(null);
    try {
      const created = await supportService.submitInquiry({
        email: user.email,
        topic: query.trim() || 'General support',
      });
      setInquiry(created);
    } catch {
      setError('We couldn’t send your inquiry. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Help and Support" />

      <AppText variant="display">How can I help?</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Find an answer or get in touch.
      </AppText>

      <AppText variant="label">Search help</AppText>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search common questions" />

      <AppText variant="title" style={styles.sectionTitle}>
        Frequently asked questions
      </AppText>

      {faqs.length === 0 ? (
        <AppText variant="body" color={colors.text.secondary}>
          No question matches “{query.trim()}”. Submit an inquiry below and we’ll help directly.
        </AppText>
      ) : (
        faqs.map((faq) => (
          <View key={faq.id} style={styles.faqCard}>
            <View style={styles.faqHead}>
              <Ionicons name="document-text-outline" size={22} color={colors.text.brand} />
              <AppText variant="cardTitle" style={styles.faqQuestion}>
                {faq.question}
              </AppText>
            </View>
            <AppText variant="caption" style={styles.faqAnswer}>
              {faq.answer}
            </AppText>
          </View>
        ))
      )}

      <HelpNote>
        Contact support
        {'\n'}
        {SUPPORT_EMAIL}
        {'\n'}Sample contact · replace before release
      </HelpNote>

      <Button label="Submit a Support Inquiry" loading={sending} onPress={() => void submit()} />

      {inquiry ? (
        <HelpNote tone="success" title={`Inquiry ${inquiry.reference} sent`}>
          We’ll reply to {inquiry.email}. This demo records the inquiry on your device only.
        </HelpNote>
      ) : null}

      {error ? <HelpNote tone="danger">{error}</HelpNote> : null}

      <Pressable accessibilityRole="button" hitSlop={6} onPress={() => navigation.navigate('AIAssistant')}>
        <AppText variant="bodyStrong">Ask the VetLink Assistant</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  sectionTitle: { marginTop: spacing.sm },
  faqCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  faqHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  faqQuestion: { flex: 1 },
  faqAnswer: { marginLeft: 38 },
});
