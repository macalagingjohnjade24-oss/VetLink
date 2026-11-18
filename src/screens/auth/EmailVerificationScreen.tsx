import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { CodeInput } from '../../components/CodeInput';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { TextLink } from '../../components/TextLink';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

const RESEND_SECONDS = 30;

/** PO-08 Email Verification — simulated code entry (no email is sent). */
export function EmailVerificationScreen({ navigation, route }: ScreenProps<'EmailVerification'>) {
  const { verifyEmail, resendVerification } = useAuth();
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
    try {
      const ok = await verifyEmail(email, code);
      if (ok) setVerified(true);
      else setError('That code is incorrect. Check the email and try again.');
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'That code is no longer valid. Request a new one and try again.',
      );
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await resendVerification(email);
      setResendIn(RESEND_SECONDS);
      setResent(true);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'We could not resend the code. Please try again.');
    }
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
          <TextLink
            label={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            icon="mail-outline"
            align="center"
            disabled={resendIn > 0}
            onPress={() => void resend()}
          />
          {resent ? <AppText variant="caption">A new verification code has been sent.</AppText> : null}
          <HelpNote>
            Can’t find the email? Check your spam folder, or open the confirmation link it contains.
          </HelpNote>
        </>
      )}

      <View style={styles.footerLinks}>
        <TextLink label="Back to Login" align="center" onPress={() => navigation.navigate('Login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  footerLinks: { marginTop: spacing.sm },
});
