import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, Text, View } from 'react-native';

import type { ProfileRecord } from '../../../lib/supabase/types';
import { styles } from './profileScreen.styles';

type ProfileHeroProps = {
  avatarAnim: Animated.Value;
  eventCount: number;
  heroAnim: Animated.Value;
  initial: string;
  isGuest: boolean;
  memberSince: string;
  onEditProfile: () => void;
  onOpenPhotoPreview: () => void;
  profile: ProfileRecord | null;
  statsAnim: Animated.Value;
};

export function ProfileHero({
  avatarAnim,
  eventCount,
  heroAnim,
  initial,
  isGuest,
  memberSince,
  onEditProfile,
  onOpenPhotoPreview,
  profile,
  statsAnim,
}: ProfileHeroProps) {
  return (
    <Animated.View
      style={[
        styles.hero,
        {
          opacity: heroAnim,
          transform: [
            {
              translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }),
            },
          ],
        },
      ]}
    >
      {/*<View style={styles.heroHeader}>
        <Text style={styles.heroEyebrow}>
          {isGuest ? 'Guest Mode' : profile?.role === 'admin' ? 'Admin' : ''}
        </Text>
      </View>*/}

      <Animated.View
        style={[
          styles.avatarSection,
          {
            opacity: avatarAnim,
            transform: [
              {
                scale: avatarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
              },
            ],
          },
        ]}
      >
        <Pressable
          accessibilityLabel="View profile photo"
          accessibilityRole="button"
          style={({ pressed }) => [styles.avatarPressable, pressed && styles.avatarPressed]}
          onPress={onOpenPhotoPreview}
        >
          <LinearGradient
            colors={['#0F172A', '#1D4ED8', '#60A5FA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              {profile?.avatar_url ? (
                <Image
                  contentFit="cover"
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatarImg}
                  transition={200}
                />
              ) : (
                <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </LinearGradient>
              )}
            </View>
          </LinearGradient>
        </Pressable>

        {!isGuest && (
          <Pressable
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            style={({ pressed }) => [styles.activeDot, pressed && { opacity: 0.85 }]}
            onPress={onEditProfile}
          >
            <Ionicons name="create-outline" size={13} color="#F8FAFC" />
          </Pressable>
        )}
      </Animated.View>

      <Text style={styles.heroName}>
        {profile?.full_name ?? (isGuest ? 'Guest Explorer' : 'Eventure User')}
      </Text>
      <Text style={styles.heroEmail}>
        {isGuest
          ? 'Sign in to build your organizer identity and personalize your profile.'
          : profile?.bio?.trim() || 'Add a short bio so people can get to know you.'}
      </Text>

      {profile?.is_suspended && (
        <View style={styles.suspendedBadge}>
          <Ionicons name="warning-outline" size={11} color="#FCA5A5" />
          <Text style={styles.suspendedText}>Suspended</Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.statsRow,
          {
            opacity: statsAnim,
            transform: [
              {
                translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
              },
            ],
          },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{isGuest ? '-' : eventCount}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{isGuest ? '-' : '0'}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {isGuest ? 'Guest' : memberSince}
          </Text>
          <Text style={styles.statLabel}>Member Since</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
