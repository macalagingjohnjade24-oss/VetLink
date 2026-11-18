import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { TextLink } from '../../components/TextLink';
import { useAuth } from '../../context/AuthContext';
import { AuthError } from '../../services/authService';
import { colors, spacing } from '../../theme';
import { isEmail } from '../../utils/validation';
import type { ScreenProps } from '../../navigation/types';

/** PO-09 Forgot Password */
export function ForgotPasswordScreen({ navigation }: ScreenProps<'ForgotPassword'>) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) return setError('Email address is required.');
    if (!isEmail(email)) return setError('Enter a valid email address.');
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (submitError) {
      setError(
        submitError instanceof AuthError
          ? submitError.message
          : 'We could not send the reset email. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Forgot Password" onBack={() => navigation.goBack()} />

      <AppText variant="display">Forgot Password</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Enter your email and we’ll send a secure reset link.
      </AppText>

      {sent ? (
        <HelpNote tone="success" title="Reset link sent">
          If an account exists for {email.trim()}, a password reset link is on its way. Open the link on this device to
          choose a new password.
        </HelpNote>
      ) : (
        <>
          <Input
            label="Email address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            placeholder="alex.santos@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={error ?? undefined}
            containerStyle={styles.input}
          />
          <Button label="Send Reset Link" onPress={onSubmit} loading={submitting} />
        </>
      )}

      <TextLink label="Back to Login" align="center" onPress={() => navigation.navigate('Login')} />

      <HelpNote>For your privacy, a reset email is sent only if an account exists.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  input: { marginTop: spacing.sm },
});
