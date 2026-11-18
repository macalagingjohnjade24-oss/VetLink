import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { PetAvatar } from '../../components/PetAvatar';
import { Screen } from '../../components/Screen';
import { usePets } from '../../context/PetContext';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

/** PO-36 Pet Photo Upload */
export function PetPhotoScreen({ navigation, route }: PetsScreenProps<'PetPhoto'>) {
  const petId = route.params?.petId;
  const { getPet, setPhoto, setPendingPhoto, pendingPhoto } = usePets();
  const pet = petId ? getPet(petId) : null;

  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === 'camera'
          ? 'Camera access is off. You can upload a photo from your gallery instead.'
          : 'Photo access is off. Enable it in your device settings to add a photo.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });

    if (result.canceled) return;
    setPicked(result.assets[0].uri);
  };

  const save = async () => {
    if (!picked) return;
    const photo = { uri: picked };
    if (petId) {
      await setPhoto(petId, photo);
    } else {
      setPendingPhoto(photo);
    }
    navigation.goBack();
  };

  const preview = picked ? { uri: picked } : (pet?.photo ?? pendingPhoto ?? null);
  const previewPet = { name: pet?.name ?? 'Your pet', photo: preview };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Pet Photo Upload" />

      <AppText variant="display">A face you love</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Choose a clear photo of your pet.
      </AppText>

      <View style={styles.preview}>
        {preview ? (
          <Image source={preview} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <PetAvatar pet={previewPet} size={140} radius={radii.card} />
        )}
      </View>

      <Button
        label="Take Photo"
        variant="secondary"
        icon="camera-outline"
        onPress={() => void pick('camera')}
      />
      <Button
        label="Upload from Gallery"
        variant="secondary"
        icon="images-outline"
        onPress={() => void pick('library')}
      />

      {error ? (
        <AppText variant="caption" color={colors.status.danger}>
          {error}
        </AppText>
      ) : null}

      <HelpNote>
        Photo preview · JPG or PNG
        {'\n'}Camera and gallery access are requested on your device.
      </HelpNote>

      <Button label="Save Photo" disabled={!picked} onPress={() => void save()} />
      <Button label="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  preview: {
    height: 240,
    borderRadius: radii.card,
    backgroundColor: colors.surface.subtle,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
});
