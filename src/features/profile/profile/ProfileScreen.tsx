import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchMyCreatedEvents } from '../../events/api';
import type { AppTabScreenProps } from '../../../navigation/types';
import { useAppSession } from '../../../providers/AppSessionProvider';
import { ProfileAuthenticatedContent } from './ProfileAuthenticatedContent';
import { ProfileGuestSection } from './ProfileGuestSection';
import { ProfileHero } from './ProfileHero';
import { ProfilePhotoPreview } from './ProfilePhotoPreview';
import { formatMemberSince, getRoleMeta, type ProfileMenuAction } from './profileScreen.shared';
import { styles } from './profileScreen.styles';

type ProfileScreenProps = AppTabScreenProps<'Profile'>;

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { isGuest, profile, signOut } = useAppSession();
  const [eventCount, setEventCount] = useState(0);
  const [isPhotoPreviewVisible, setIsPhotoPreviewVisible] = useState(false);

  const roleMeta = getRoleMeta(profile?.role, isGuest);
  const memberSince = formatMemberSince(profile?.created_at);
  const initial = profile?.full_name?.slice(0, 1)?.toUpperCase() ?? (isGuest ? 'G' : '?');

  const heroAnim = useRef(new Animated.Value(0)).current;
  const avatarAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(heroAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(avatarAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(statsAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(bodyAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [avatarAnim, bodyAnim, heroAnim, statsAnim]);

  useFocusEffect(
    useCallback(() => {
      if (isGuest || !profile) {
        setEventCount(0);
        return;
      }

      void (async () => {
        const { data } = await fetchMyCreatedEvents(profile.id);
        setEventCount(data.length);
      })();
    }, [isGuest, profile]),
  );

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  }, [signOut]);

  const handleMenuPress = useCallback(
    (action: ProfileMenuAction) => {
      switch (action) {
        case 'notifications':
          navigation.navigate('Notifications');
          break;
        case 'privacy':
          navigation.navigate('Privacy');
          break;
        case 'help':
          navigation.navigate('Help');
          break;
      }
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#0B1733', '#12305D', '#1D4E89', '#3B82C4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={StyleSheet.absoluteFill}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scroll}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          <ProfileHero
            avatarAnim={avatarAnim}
            eventCount={eventCount}
            heroAnim={heroAnim}
            initial={initial}
            isGuest={isGuest}
            memberSince={memberSince}
            onEditProfile={() => navigation.navigate('EditProfile')}
            onOpenPhotoPreview={() => setIsPhotoPreviewVisible(true)}
            profile={profile}
            statsAnim={statsAnim}
          />

          {isGuest && <View style={styles.guestSpacer} />}

          <Animated.View
            style={[
              styles.body,
              isGuest && styles.bodyGuest,
              {
                opacity: bodyAnim,
                transform: [
                  {
                    translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                  },
                ],
              },
            ]}
          >
            {isGuest ? (
              <ProfileGuestSection
                onExplore={() => navigation.navigate('Explore')}
                onSignIn={() => void signOut()}
              />
            ) : (
              <ProfileAuthenticatedContent
                memberSince={memberSince}
                onAdminPanel={() => navigation.navigate('AdminUsers')}
                onCreateEvent={() => navigation.navigate('CreateEvent')}
                onExplore={() => navigation.navigate('Explore')}
                onMenuPress={handleMenuPress}
                onMyEvents={() => navigation.navigate('MyEvents')}
                onMyRegistrations={() => navigation.navigate('MyRegistrations')}
                onNotifications={() => navigation.navigate('Notifications')}
                onSaved={() => navigation.navigate('Saved')}
                onSignOut={handleSignOut}
                profile={profile}
                roleLabel={roleMeta.label}
              />
            )}
          </Animated.View>
        </ScrollView>
      </View>

      <ProfilePhotoPreview
        initial={initial}
        isGuest={isGuest}
        onClose={() => setIsPhotoPreviewVisible(false)}
        profile={profile}
        visible={isPhotoPreviewVisible}
      />
    </SafeAreaView>
  );
}
