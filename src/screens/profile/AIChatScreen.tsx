import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { LinkButton } from '../../components/LinkButton';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { ASSISTANT_WELCOME } from '../../data/mockAssistant';
import { aiAssistantService } from '../../services/aiAssistantService';
import { colors, fontFamily, radii, spacing } from '../../theme';
import type { AIScreenProps, RootStackParamList } from '../../navigation/types';

type Message = { id: string; role: 'owner' | 'assistant'; text: string };

/** PO-52 AI Chat Interface */
export function AIChatScreen({ navigation, route }: AIScreenProps<'AIChat'>) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', text: ASSISTANT_WELCOME(user?.firstName ?? 'there') },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const asked = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setMessages((current) => [...current, { id: `owner-${Date.now()}`, role: 'owner', text: trimmed }]);
    setInput('');
    setPending(true);
    const reply = await aiAssistantService.reply(trimmed);
    setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: reply }]);
    setPending(false);
  };

  useEffect(() => {
    const question = route.params?.question;
    if (!question || asked.current) return;
    asked.current = true;
    void ask(question);
    // The question is only sent once, on arrival from a suggested question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.question]);

  const lastQuestion = [...messages].reverse().find((message) => message.role === 'owner')?.text;

  return (
    <Screen
      contentStyle={styles.content}
      scrollRef={scrollRef}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      <AppHeader title="AI Chat Interface" />

      <AppText variant="badge" color={colors.text.brand} style={styles.eyebrow}>
        VetLink AI Assistant
      </AppText>

      <HelpNote>General guidance only. Not veterinary medical advice.</HelpNote>

      {messages.map((message) => (
        <View
          key={message.id}
          style={[styles.bubble, message.role === 'owner' ? styles.ownerBubble : styles.assistantBubble]}
        >
          <AppText variant="body" color={message.role === 'owner' ? colors.text.inverse : colors.text.brand}>
            {message.text}
          </AppText>
        </View>
      ))}

      {pending ? <AppText variant="caption">● ● ● Preparing a response…</AppText> : null}

      <LinkButton
        label="Find a veterinary clinic"
        icon="location-outline"
        onPress={() =>
          navigation
            .getParent<NativeStackNavigationProp<RootStackParamList>>()
            ?.navigate('Main', { screen: 'ClinicsTab', params: { screen: 'ClinicDiscovery' } })
        }
      />
      <LinkButton
        label="More suggested questions"
        icon="help-circle-outline"
        onPress={() => navigation.navigate('AISuggestedQuestions')}
      />

      <Button
        label="Leave an Inquiry for Clinic Staff"
        variant="secondary"
        onPress={() =>
          navigation.navigate('AIInquiryForm', {
            category: 'Appointment assistance',
            details: lastQuestion,
          })
        }
      />

      <HelpNote>
        If your pet needs urgent attention, contact a veterinarian directly. Do not wait for an AI response.
      </HelpNote>

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
          onSubmitEditing={() => void ask(input)}
          placeholder="Type your question…"
          placeholderTextColor={colors.text.subtle}
          returnKeyType="send"
          submitBehavior="submit"
          accessibilityLabel="Message"
          style={styles.composerInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!input.trim() || pending}
          onPress={() => void ask(input)}
          hitSlop={8}
        >
          <Ionicons
            name="send"
            size={18}
            color={input.trim() && !pending ? colors.brand.primary : colors.text.subtle}
          />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  eyebrow: { letterSpacing: 0.6, textTransform: 'uppercase' },
  bubble: { padding: spacing.lg, borderRadius: radii.card, maxWidth: '92%' },
  assistantBubble: { backgroundColor: colors.brand.peach, alignSelf: 'flex-start' },
  ownerBubble: { backgroundColor: colors.brand.primary, alignSelf: 'flex-end' },
  composer: {
    minHeight: 52,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    paddingHorizontal: spacing.lg - 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },
});
