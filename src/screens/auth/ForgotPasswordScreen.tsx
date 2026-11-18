import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
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
    await requestPasswordReset(email);
    setSubmitting(false);
    setSent(true);
  };

  return (
    <Screen safeBottom contentStyle={styles.content}>
      <AppHeader title="Forgot Password" onBack={() => navigation.goBack()} />

      <AppText variant="display">Forgot Password</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Enter your email and we’ll send a secure reset link.
      </AppText>

      {sent ? (
        <HelpNote tone="success" title="Reset link sent">
          If an account exists for {email.trim()}, a password reset link has been sent. For this demo you can continue
          straight to the reset screen.
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

      {sent ? (
        <Button label="Continue to Reset Password" onPress={() => navigation.navigate('ResetPassword', { email })} />
      ) : null}

      <Pressable onPress={() => navigation.navigate('Login')} hitSlop={6}>
        <AppText variant="bodyStrong">Back to Login</AppText>
      </Pressable>

      <HelpNote>For your privacy, a reset email is sent only if an account exists.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  input: { marginTop: spacing.sm },
});
