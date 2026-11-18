import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { CodeInput } from '../../components/CodeInput';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

const RESEND_SECONDS = 30;

/** PO-08 Email Verification — simulated code entry (no email is sent). */
export function EmailVerificationScreen({ navigation, route }: ScreenProps<'EmailVerification'>) {
  const { verifyEmail } = useAuth();
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const onVerify = async () => {
    if (code.length !== 6) {
      setError('Enter the six-digit code.');
      return;
    }
    setChecking(true);
    setError(null);
    const ok = await verifyEmail(email, code);
    setChecking(false);
    if (ok) setVerified(true);
    else setError('That code is incorrect. Check the email and try again.');
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Email Verification" onBack={() => navigation.goBack()} />

      <AppText variant="display">Verify Your Email</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        We sent a six-digit code to {email}.
      </AppText>

      <CodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} error={!!error} />
      {error ? (
        <AppText variant="caption" color={colors.status.danger}>
          {error}
        </AppText>
      ) : null}

      {verified ? (
        <HelpNote tone="success" title="Email verified">
          Your account is ready. Log in with your email address and password to continue.
        </HelpNote>
      ) : (
        <>
          <AppText variant="caption">
            {resendIn > 0 ? `Code expires in 00:${String(resendIn).padStart(2, '0')}` : 'The code has expired. Request a new one.'}
          </AppText>
          <Button label="Verify Account" onPress={onVerify} loading={checking} />
          <Pressable
            disabled={resendIn > 0}
            onPress={() => {
              setResendIn(RESEND_SECONDS);
              setResent(true);
            }}
            hitSlop={6}
          >
            <AppText variant="bodyStrong" color={resendIn > 0 ? colors.text.subtle : colors.text.brand}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </AppText>
          </Pressable>
          {resent && resendIn === RESEND_SECONDS ? (
            <AppText variant="caption">A new demo code has been generated.</AppText>
          ) : null}
          <HelpNote>Demo code: 482619. No email is actually sent in this build.</HelpNote>
        </>
      )}

      <View style={styles.footerLinks}>
        {verified ? (
          <Button label="Back to Login" variant="secondary" onPress={() => navigation.navigate('Login')} />
        ) : (
          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={6}>
            <AppText variant="bodyStrong">Back to Login</AppText>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  footerLinks: { marginTop: spacing.sm },
});
