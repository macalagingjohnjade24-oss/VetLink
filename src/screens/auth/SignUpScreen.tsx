import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { AuthError } from '../../services/authService';
import { colors, spacing } from '../../theme';
import { isEmail, isMobileNumber, isStrongPassword, passwordHint } from '../../utils/validation';
import type { ScreenProps } from '../../navigation/types';

type FieldKey = 'firstName' | 'lastName' | 'email' | 'mobile' | 'password' | 'confirm';

/** PO-07 Create Account */
export function SignUpScreen({ navigation }: ScreenProps<'SignUp'>) {
  const { register } = useAuth();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    password: '',
    confirm: '',
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey | 'terms' | 'form', string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: FieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const onSubmit = async () => {
    const next: Partial<Record<FieldKey | 'terms' | 'form', string>> = {};
    if (!values.firstName.trim()) next.firstName = 'First name is required.';
    if (!values.lastName.trim()) next.lastName = 'Last name is required.';
    if (!values.email.trim()) next.email = 'Email address is required.';
    else if (!isEmail(values.email)) next.email = 'Enter a valid email address.';
    if (!values.mobile.trim()) next.mobile = 'Mobile number is required.';
    else if (!isMobileNumber(values.mobile)) next.mobile = 'Enter a valid mobile number.';
    if (!values.password) next.password = 'Password is required.';
    else if (!isStrongPassword(values.password)) next.password = passwordHint;
    if (values.confirm !== values.password) next.confirm = 'Passwords do not match.';
    if (!terms) next.terms = 'Please accept the Terms and Privacy Policy.';

    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        mobile: values.mobile,
        password: values.password,
      });
      navigation.navigate('EmailVerification', { email: values.email.trim().toLowerCase() });
    } catch (error) {
      setErrors({
        form: error instanceof AuthError ? error.message : 'We could not create your account. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard contentStyle={styles.content}>
      <AppHeader title="Create Account" onBack={() => navigation.goBack()} />

      <AppText variant="display">Create your VetLink account</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Care starts with a connection.
      </AppText>

      <View style={styles.form}>
        <Input label="First name" value={values.firstName} onChangeText={(v) => setValue('firstName', v)} placeholder="Alex" error={errors.firstName} />
        <Input label="Last name" value={values.lastName} onChangeText={(v) => setValue('lastName', v)} placeholder="Santos" error={errors.lastName} />
        <Input
          label="Email address"
          value={values.email}
          onChangeText={(v) => setValue('email', v)}
          placeholder="alex.santos@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
        <Input
          label="Mobile number"
          value={values.mobile}
          onChangeText={(v) => setValue('mobile', v)}
          placeholder="+63 917 555 0142"
          keyboardType="phone-pad"
          error={errors.mobile}
        />
        <Input
          label="Password"
          value={values.password}
          onChangeText={(v) => setValue('password', v)}
          placeholder="Create a password"
          secureTextEntry
          autoCapitalize="none"
          helper={passwordHint}
          error={errors.password}
        />
        <Input
          label="Confirm password"
          value={values.confirm}
          onChangeText={(v) => setValue('confirm', v)}
          placeholder="Re-enter your password"
          secureTextEntry
          autoCapitalize="none"
          error={errors.confirm}
        />
      </View>

      <View style={styles.terms}>
        <Checkbox checked={terms} onChange={setTerms} label="I agree to the Terms and Privacy Policy." error={!!errors.terms} />
        {errors.terms ? (
          <AppText variant="caption" color={colors.status.danger}>
            {errors.terms}
          </AppText>
        ) : null}
      </View>

      {errors.form ? (
        <HelpNote tone="danger" title="Registration failed">
          {errors.form}
        </HelpNote>
      ) : null}

      <Button label="Create Account" onPress={onSubmit} loading={submitting} />

      <Pressable onPress={() => navigation.navigate('Login')} hitSlop={6}>
        <AppText variant="bodyStrong">Already have an account? Login</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  form: { gap: spacing.lg, marginTop: spacing.sm },
  terms: { gap: spacing.xs },
});
