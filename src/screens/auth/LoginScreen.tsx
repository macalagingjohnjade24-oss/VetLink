import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../data/mockUsers';
import { AuthError } from '../../services/authService';
import { colors, spacing } from '../../theme';
import { isEmail } from '../../utils/validation';
import type { ScreenProps } from '../../navigation/types';

/** PO-06 Login */
export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email address is required.';
    else if (!isEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await signIn(email, password, remember);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.code === 'unverified') {
          navigation.navigate('EmailVerification', { email: email.trim() });
          return;
        }
        setErrors({ form: error.message });
      } else {
        setErrors({ form: 'Something went wrong. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard contentStyle={styles.content}>
      <AppHeader title="Login" onBack={() => navigation.navigate('Welcome')} />

      <View style={styles.brandRow}>
        <Logo size="md" />
      </View>

      <AppText variant="display">Welcome back</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Log in to keep your pet’s care connected.
      </AppText>

      <View style={styles.form}>
        <Input
          label="Email address"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setErrors((e) => ({ ...e, email: undefined, form: undefined }));
          }}
          placeholder="alex.santos@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.email}
        />
        <Input
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrors((e) => ({ ...e, password: undefined, form: undefined }));
          }}
          placeholder="Enter your password"
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          error={errors.password}
        />

        <View style={styles.row}>
          <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={6}>
            <AppText variant="link">Forgot Password?</AppText>
          </Pressable>
        </View>

        {errors.form ? (
          <HelpNote tone="danger" title="Sign in failed">
            {errors.form}
          </HelpNote>
        ) : null}

        <Button label="Login" onPress={onSubmit} loading={submitting} />

        <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={6}>
          <AppText variant="bodyStrong">New to VetLink? Sign Up</AppText>
        </Pressable>
      </View>

      <View style={styles.demoCard}>
        <View style={styles.demoText}>
          <AppText variant="bodyStrong">Demo account</AppText>
          <AppText variant="caption">
            {DEMO_EMAIL} · {DEMO_PASSWORD}
          </AppText>
          <AppText variant="small">Works offline — no database or backend required.</AppText>
        </View>
        <Button
          label="Use demo account"
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={() => {
            setEmail(DEMO_EMAIL);
            setPassword(DEMO_PASSWORD);
            setErrors({});
          }}
        />
      </View>

      <HelpNote>Use a valid email address. Your password is kept private.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  brandRow: { marginTop: spacing.sm },
  form: { gap: spacing.lg, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  demoCard: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface.card,
  },
  demoText: { gap: 2 },
});
