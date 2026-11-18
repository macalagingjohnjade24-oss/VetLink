import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { AuthError } from '../../services/authService';
import { colors, spacing } from '../../theme';

const hasLength = (value: string) => value.length >= 8;
const hasCase = (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value);
const hasNumber = (value: string) => /\d/.test(value);

/** PO-59 Change Password */
export function ChangePasswordScreen() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updated, setUpdated] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = async () => {
    setError(null);
    setUpdated(false);
    if (!current) {
      setError('Enter your current password.');
      return;
    }
    if (!hasLength(next) || !hasCase(next) || !hasNumber(next)) {
      setError('Your new password needs at least 8 characters, uppercase and lowercase letters, and a number.');
      return;
    }
    if (next !== confirm) {
      setError('Passwords don’t match. Re-enter the same new password in both fields.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setUpdated(true);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'We couldn’t update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content} keyboard>
      <AppHeader title="Change Password" />

      <AppText variant="display">Keep your account secure</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Choose a password only you know.
      </AppText>

      <Input
        label="Current password"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Current password"
      />
      <Input
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoCapitalize="none"
        placeholder="New password"
      />
      <Input
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Confirm new password"
      />

      <HelpNote>
        {hasLength(next) ? '✓' : '•'} At least 8 characters
        {'\n'}
        {hasCase(next) ? '✓' : '•'} Include uppercase and lowercase letters
        {'\n'}
        {hasNumber(next) ? '✓' : '•'} Include at least one number
      </HelpNote>

      {mismatch && !error ? (
        <HelpNote tone="danger" title="Passwords don’t match">
          Re-enter the same new password in both fields.
        </HelpNote>
      ) : null}

      {error ? <HelpNote tone="danger">{error}</HelpNote> : null}

      {updated ? (
        <HelpNote tone="success" title="✓ Password updated successfully">
          Use your new password the next time you sign in.
        </HelpNote>
      ) : null}

      <Button label="Update Password" loading={saving} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
});
