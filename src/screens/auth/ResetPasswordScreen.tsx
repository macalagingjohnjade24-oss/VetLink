import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { AuthError } from '../../services/authService';
import { colors, spacing } from '../../theme';
import { passwordChecks } from '../../utils/validation';
import type { ScreenProps } from '../../navigation/types';

/** PO-10 Reset Password */
export function ResetPasswordScreen({ navigation, route }: ScreenProps<'ResetPassword'>) {
  const { resetPassword } = useAuth();
  const email = route.params?.email ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [linkError, setLinkError] = useState<string | null>(route.params?.error ?? null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checks = passwordChecks(password);

  const onSubmit = async () => {
    const next: typeof errors = {};
    if (!Object.values(checks).every(Boolean)) next.password = 'Password does not meet all requirements.';
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setLinkError(null);
    try {
      await resetPassword(email, password);
      setDone(true);
    } catch (error) {
      setLinkError(
        error instanceof AuthError
          ? error.message
          : 'We could not reset your password. Please request a new reset link.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Reset Password" onBack={() => navigation.goBack()} />

      <AppText variant="display">Reset Password</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Choose a strong password you haven’t used before.
      </AppText>

      {linkError ? (
        <HelpNote tone="danger" title="Reset link problem">
          {linkError}
        </HelpNote>
      ) : null}

      <Input
        label="New password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setErrors({});
        }}
        placeholder="New password"
        secureTextEntry
        autoCapitalize="none"
        error={errors.password}
      />
      <Input
        label="Confirm new password"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setErrors((e) => ({ ...e, confirm: undefined }));
        }}
        placeholder="Confirm new password"
        secureTextEntry
        autoCapitalize="none"
        error={errors.confirm}
      />

      <HelpNote>
        <View style={styles.rules}>
          {[
            { ok: checks.length, label: 'At least 8 characters' },
            { ok: checks.uppercase, label: 'One uppercase letter' },
            { ok: checks.number, label: 'One number' },
          ].map((rule) => (
            <AppText
              key={rule.label}
              variant="caption"
              color={rule.ok ? colors.status.success : colors.text.brand}
            >
              {rule.ok ? '✓' : '○'} {rule.label}
            </AppText>
          ))}
        </View>
      </HelpNote>

      {done ? (
        <HelpNote tone="success" title="✓ Password reset successfully">
          {email ? `You can now log in with your new password for ${email}.` : 'You can now log in with your new password.'}
        </HelpNote>
      ) : (
        <Button label="Reset Password" onPress={onSubmit} loading={submitting} />
      )}

      <Button
        label="Back to Login"
        variant={done ? 'primary' : 'secondary'}
        onPress={() => navigation.navigate('Login')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  rules: { gap: 2 },
});
