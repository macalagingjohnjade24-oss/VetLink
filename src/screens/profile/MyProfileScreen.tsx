import { Image, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { LinkCard } from '../../components/Card';
import { LinkButton } from '../../components/LinkButton';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { usePets } from '../../context/PetContext';
import { colors, radii, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

const joinNames = (names: string[]) => {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

/** PO-56 My Profile */
export function MyProfileScreen({ navigation }: ProfileScreenProps<'MyProfile'>) {
  const { user } = useAuth();
  const { pets } = usePets();

  if (!user) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="My Profile" showBack={false} />
        <AppText variant="title">You’re signed out.</AppText>
      </Screen>
    );
  }

  const familyLine = pets.length === 0 ? 'Your pet parent profile' : `Pet parent to ${joinNames(pets.map((pet) => pet.name))}`;
  const photo = user.avatarUri ? { uri: user.avatarUri } : require('../../../assets/profile/owner.jpg');

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="My Profile" showBack={false} />

      <Image source={photo} style={styles.photo} resizeMode="cover" accessibilityLabel="Your profile photo" />

      <AppText variant="display">
        {user.firstName} {user.lastName}
      </AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {familyLine}
      </AppText>

      <View style={styles.contact}>
        <AppText variant="cardTitle">{user.email}</AppText>
        <AppText variant="body" color={colors.text.secondary} style={styles.contactLine}>
          {user.mobile}
          {'\n'}
          {user.address || 'Add your address in Edit Profile'}
        </AppText>
      </View>

      <Button label="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />

      <LinkCard
        icon="document-text-outline"
        title="Account Settings"
        caption="Personal details, preferences & security"
        onPress={() => navigation.navigate('AccountSettings')}
      />
      <LinkCard
        icon="help-circle-outline"
        title="Help & Support"
        caption="A little help, whenever you need it"
        onPress={() => navigation.navigate('HelpSupport')}
      />

      <LinkButton label="Log Out" icon="log-out-outline" onPress={() => navigation.navigate('Logout')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  photo: {
    width: '100%',
    height: 184,
    borderRadius: radii.card,
    backgroundColor: colors.surface.subtle,
  },
  contact: { gap: spacing.xs, marginTop: spacing.sm },
  contactLine: { lineHeight: 22 },
});
