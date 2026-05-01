import { useFocusEffect } from '@react-navigation/native';
import type { AppTabScreenProps } from '../../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from 'react-native';

import { useAppSession } from '../../../providers/AppSessionProvider';
import { DarkHero } from '../../../components/ui/DarkHero';
import { EmptyStateCard } from '../../../components/ui/EmptyStateCard';
import { ScreenContainer } from '../../../components/ui/ScreenContainer';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { colors } from '../../../theme/colors';
import { layout } from '../../../theme/layout';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';
import { fetchEventsByIds, fetchMyFavoritedEvents } from '../api';
import { formatEventDateTime, formatEventStatus, capitalizeLocation } from '../formatters';
import type { EventSummary } from '../types';
import { useEventFavorites } from '../FavoritesProvider';

type SavedEventsScreenProps = AppTabScreenProps<'Saved'>;

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  upcoming: { text: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  ongoing: { text: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  completed: { text: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  cancelled: { text: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

function SavedEventCard({
  event,
  onPress,
  onToggleFavorite,
}: {
  event: EventSummary;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const statusStyle = STATUS_COLORS[event.status] ?? STATUS_COLORS.upcoming;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cardImageWrap}>
        {event.coverImageUrl ? (
          <Image
            contentFit="cover"
            source={{ uri: event.coverImageUrl }}
            style={styles.cardImage}
            transition={150}
          />
        ) : (
          <View style={styles.cardImageFallback}>
            <Ionicons color="rgba(255,255,255,0.35)" name="heart" size={30} />
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {formatEventStatus(event.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {event.title}
          </Text>
          <Pressable
            accessibilityLabel="Remove from saved"
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              onToggleFavorite();
            }}
            style={({ pressed }) => [styles.favoriteBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons color="#EF4444" name="heart" size={18} />
          </Pressable>
        </View>

        <View style={styles.cardMetaRow}>
          <Ionicons color="#94A3B8" name="calendar-outline" size={13} />
          <Text style={styles.cardMetaText}>{formatEventDateTime(event.startsAt)}</Text>
        </View>
        <View style={styles.cardMetaRow}>
          <Ionicons color="#94A3B8" name="location-outline" size={13} />
          <Text numberOfLines={1} style={styles.cardMetaText}>{capitalizeLocation(event.location)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function SavedEventsScreen({ navigation }: SavedEventsScreenProps) {
  const { isGuest, profile, signOut } = useAppSession();
  const { favoriteIds, refreshFavorites, toggleFavorite } = useEventFavorites();
  const [cachedEvents, setCachedEvents] = useState<Record<string, EventSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removedModalVisible, setRemovedModalVisible] = useState(false);
  const hasFetchedRef = useRef(false);

  const mergeCachedEvents = useCallback((events: EventSummary[]) => {
    setCachedEvents((previous) => {
      const next = { ...previous };
      for (const event of events) {
        next[event.id] = event;
      }
      return next;
    });
  }, []);

  const savedEvents = useMemo(
    () => favoriteIds.map((id) => cachedEvents[id]).filter((event): event is EventSummary => Boolean(event)),
    [cachedEvents, favoriteIds],
  );

  const loadSavedEvents = useCallback(async (forceRefresh = false) => {
    if (isGuest || !profile?.id) {
      setCachedEvents({});
      setErrorMessage(null);
      setIsLoading(false);
      setIsRefreshing(false);
      hasFetchedRef.current = false;
      return;
    }

    if (!forceRefresh && hasFetchedRef.current) {
      return;
    }

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      await refreshFavorites();
      const { data, error } = await fetchMyFavoritedEvents(profile.id);
      if (error) {
        throw error;
      }
      mergeCachedEvents(data);
      hasFetchedRef.current = true;
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load saved events.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isGuest, mergeCachedEvents, profile?.id, refreshFavorites]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFetchedRef.current) {
        void loadSavedEvents();
      }
    }, [loadSavedEvents]),
  );

  useFocusEffect(
    useCallback(() => {
      if (isGuest || !profile?.id) {
        return;
      }

      const missingIds = favoriteIds.filter((id) => !cachedEvents[id]);
      if (missingIds.length === 0) {
        return;
      }

      let isActive = true;
      void (async () => {
        const { data, error } = await fetchEventsByIds(missingIds);
        if (!isActive || error) {
          return;
        }
        mergeCachedEvents(data);
      })();

      return () => {
        isActive = false;
      };
    }, [cachedEvents, favoriteIds, isGuest, mergeCachedEvents, profile?.id]),
  );

  // Inside SavedEventsScreen function
  const handleToggleFavorite = useCallback(async (eventId: string) => {
    try {
      await toggleFavorite(eventId);
      setErrorMessage(null);
      setRemovedModalVisible(true);
    } catch (error) {
      Alert.alert('Unable to update favorites', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [toggleFavorite]);

  if (isGuest) {
    return (
      <ScreenContainer bg="#F4F8FC" noPadding>
        <StatusBar style="dark" />

        <View style={styles.guestContainer}>
          <View style={styles.guestIconWrap}>
            <Ionicons color="#FB7185" name="heart" size={40} />
          </View>
          <Text style={styles.guestTitle}>Saved Events</Text>
          <Text style={styles.guestSub}>
            Sign in to save events and access your favorites across devices.
          </Text>
          <Pressable
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.guestBtnSurface}>
              <Text style={styles.guestBtnText}>Sign In</Text>
            </View>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg={colors.bgDark} noPadding>
      <StatusBar style="light" />

      <Modal
        animationType="fade"
        onRequestClose={() => setRemovedModalVisible(false)}
        transparent
        visible={removedModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, styles.modalIconRemoved]}>
              <Ionicons name="heart-dislike" size={22} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Event removed</Text>
            <Text style={styles.modalMessage}>This event has been removed from your saved list.</Text>
            <Pressable
              style={({ pressed }) => [styles.modalOkBtn, pressed && { opacity: 0.88 }]}
              onPress={() => setRemovedModalVisible(false)}
            >
              <Text style={styles.modalOkBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            onRefresh={() => void loadSavedEvents(true)}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <DarkHero
          eyebrow="Personal Collection"
          extraBottomInset={24}
          title="Saved Events"
          rightSlot={
            <View style={styles.heroChip}>
              <Text style={styles.heroChipCount}>{savedEvents.length}</Text>
              <Text style={styles.heroChipLabel}>saved</Text>
            </View>
          }
        />

        <View style={styles.body}>
          <View style={styles.inner}>
            <View style={styles.bodyHeader}>
              <SectionHeader title="Favorites" />
            </View>

            {savedEvents.length > 0 && !isLoading && !errorMessage ? (
              <View style={styles.list}>
                {savedEvents.map((event) => (
                  <SavedEventCard
                    event={event}
                    key={event.id}
                    onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                    onToggleFavorite={() => void handleToggleFavorite(event.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.stateWrap}>
                {errorMessage ? (
                  <EmptyStateCard
                    body={errorMessage}
                    icon="cloud-offline-outline"
                    title="Unable to load saved events"
                  />
                ) : isLoading ? (
                  <EmptyStateCard
                    body="Fetching your favorites."
                    icon="hourglass-outline"
                    title="Loading saved events"
                  />
                ) : (
                  <EmptyStateCard
                    body="Tap the heart icon on any event to save it here."
                    icon="heart-outline"
                    title="No saved events yet"
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },

  guestContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
    gap: spacing.md,
    backgroundColor: '#F4F8FC',
  },
  guestIconWrap: {
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
    borderRadius: 24,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  guestTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#0F172A',
  },
  guestSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
  },
  guestBtn: { borderRadius: radius.full, overflow: 'hidden' },
  guestBtnSurface: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.lg,
  },
  guestBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },

  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 9,
    alignItems: 'center',
  },
  heroChipCount: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#FFFFFF' },
  heroChipLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 10, color: '#D6E4FA',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  body: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flexGrow: 1,
    marginTop: -12,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xl,
  },
  inner: {
    gap: spacing.lg,
  },
  bodyHeader: {
    // removed paddingHorizontal since body already handles it
  },
  list: {
    gap: spacing.md,
  },
  stateWrap: {
    alignSelf: 'stretch',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#D7E3F4',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardImageWrap: { position: 'relative', height: 130 },
  cardImage: { width: '100%', height: '100%' },
  cardImageFallback: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryDark,
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  cardBody: { padding: spacing.md, gap: spacing.xxs },
  cardTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#0F172A',
    lineHeight: 24,
  },
  favoriteBtn: {
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderColor: '#FDD5D5',
    borderRadius: radius.full,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  cardMetaText: {
    color: '#64748B',
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },

  buttonPressed: {
    opacity: 0.85,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 10,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  modalIconRemoved: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
  },
  modalMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },
  modalOkBtn: {
    marginTop: 6,
    minWidth: 110,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOkBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});