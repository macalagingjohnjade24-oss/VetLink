import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { LinkButton } from '../../components/LinkButton';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { colors, radii, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

/** PO-57 Edit Personal Information */
export function EditProfileScreen({ navigation }: ProfileScreenProps<'EditProfile'>) {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUri ?? null);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Edit Personal Information" />
        <AppText variant="title">You’re signed out.</AppText>
      </Screen>
    );
  }

  const photo = avatarUri ? { uri: avatarUri } : require('../../../assets/profile/owner.png');

  const changePhoto = async () => {
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Photo access is off. Enable it in your device settings to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    setAvatarUri(result.assets[0].uri);
  };

  const save = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Add your first and last name.');
      return;
    }
    if (!mobile.trim()) {
      setError('Add a mobile number so your clinic can reach you.');
      return;
    }
    if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
      setError('Changing your email may require verification. Contact support to update it.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        avatarUri,
      });
      navigation.goBack();
    } catch {
      setError('We couldn’t save your details. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Edit Personal Information" />

      <AppText variant="display">Your personal information</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Keep your contact details current.
      </AppText>

      <Image source={photo} style={styles.photo} resizeMode="cover" accessibilityLabel="Your profile photo" />
      <LinkButton label="Change profile photo" icon="camera-outline" onPress={() => void changePhoto()} />
      {photoError ? (
        <AppText variant="caption" color={colors.status.danger}>
          {photoError}
        </AppText>
      ) : null}

      <Input label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
      <Input label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <Input
        label="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
      <Input label="Address (optional)" value={address} onChangeText={setAddress} />

      {error ? (
        <HelpNote tone="danger">{error}</HelpNote>
      ) : (
        <HelpNote>Changing your email may require verification.</HelpNote>
      )}

      <Button label="Save Changes" loading={saving} onPress={() => void save()} />
      <Button label="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  photo: {
    width: '100%',
    height: 132,
    borderRadius: radii.card,
    backgroundColor: colors.surface.subtle,
  },
});
