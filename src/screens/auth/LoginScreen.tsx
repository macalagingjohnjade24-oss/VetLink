import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { TextLink } from '../../components/TextLink';
import { useAuth } from '../../context/AuthContext';
import { BACKEND_SETUP_MESSAGE } from '../../lib/supabase';
import { AuthError } from '../../services/authService';
import { colors, spacing } from '../../theme';
import { isEmail } from '../../utils/validation';
import type { ScreenProps } from '../../navigation/types';

/** PO-06 Login */
export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { signIn, signInWithGoogle, isConfigured, enterOfflineMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
      if (error instanceof AuthError && error.code === 'unverified') {
        navigation.navigate('EmailVerification', { email: email.trim() });
        return;
      }
      setErrors({
        form: error instanceof AuthError ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** Opens the labelled offline demo so the app can be used without a backend. */
  const onOffline = () => {
    enterOfflineMode();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  /** Real Google OAuth through Supabase (PKCE). See supabase/README.md for provider setup. */
  const onGoogle = async () => {
    setErrors({});
    setGoogleLoading(true);
    try {
      await signInWithGoogle(remember);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      if (error instanceof AuthError && error.code === 'cancelled') return;
      setErrors({
        form: error instanceof AuthError ? error.message : 'Google sign-in is unavailable right now. Please try again.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Login" onBack={() => navigation.navigate('Welcome')} />

      <View style={styles.brandRow}>
        <Logo size="md" />
      </View>

      <AppText variant="display">Welcome back</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Log in to keep your pet’s care connected.
      </AppText>

      {!isConfigured ? (
        <HelpNote tone="danger" title="Backend not configured">
          {BACKEND_SETUP_MESSAGE}
        </HelpNote>
      ) : null}

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
          <TextLink label="Forgot Password?" onPress={() => navigation.navigate('ForgotPassword')} />
        </View>

        {errors.form ? (
          <HelpNote tone="danger" title="Sign in failed">
            {errors.form}
          </HelpNote>
        ) : null}

        <Button label="Login" onPress={onSubmit} loading={submitting} />

        <View style={styles.divider}>
          <View style={styles.rule} />
          <AppText variant="caption" color={colors.text.secondary}>
            or
          </AppText>
          <View style={styles.rule} />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          iconNode={googleMark}
          onPress={onGoogle}
          loading={googleLoading}
        />

        <View style={styles.offlineBlock}>
          <Button label="Continue in offline mode" variant="ghost" icon="cloud-offline-outline" onPress={onOffline} />
          <AppText variant="caption" color={colors.text.secondary} center>
            Offline mode opens VetLink with sample pets, appointments and clinics. Nothing is sent to a clinic and
            changes last only for this session.
          </AppText>
        </View>

        <TextLink label="New to VetLink? Sign Up" align="center" onPress={() => navigation.navigate('SignUp')} />
      </View>

      <HelpNote>Use a valid email address. Your password is kept private.</HelpNote>
    </Screen>
  );
}

const googleMark = (
  <Image source={require('../../../assets/google-g.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
);

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  brandRow: { marginTop: spacing.sm },
  form: { gap: spacing.lg, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.surface.border },
  offlineBlock: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.surface.border, paddingTop: spacing.md },
});
