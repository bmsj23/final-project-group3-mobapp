import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../../theme/colors';
import { styles } from './profileScreen.styles';

type ProfileGuestSectionProps = {
  onExplore: () => void;
  onSignIn: () => void;
};

const GUEST_FEATURES = ['Create Events', 'Manage Bookings', 'Organizer Dashboard'];

export function ProfileGuestSection({ onExplore, onSignIn }: ProfileGuestSectionProps) {
  return (
    <View style={styles.guestSection}>
      <View style={styles.guestCard}>
        <Text style={styles.guestCardTitle}>You're browsing as a guest</Text>
        <Text style={styles.guestCardSub}>
          Sign in to unlock event creation, bookings, and your personal organizer dashboard.
        </Text>

        <View style={styles.guestFeatures}>
          {GUEST_FEATURES.map((feature) => (
            <View key={feature} style={styles.guestFeatureRow}>
              <View style={styles.guestFeatureDot} />
              <Text style={styles.guestFeatureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.guestSignInBtn, pressed && { opacity: 0.85 }]}
          onPress={onSignIn}
        >
          <LinearGradient
            colors={['#060D1F', '#0F1E3D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.guestSignInGrad}
          >
            <Text style={styles.guestSignInText}>Sign in</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.exploreBtn, pressed && { opacity: 0.7 }]}
        onPress={onExplore}
      >
        <Ionicons name="compass-outline" size={18} color={colors.primary} />
        <Text style={styles.exploreBtnText}>Continue Exploring Events</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}
