import { useFocusEffect } from '@react-navigation/native';
import type { AppTabScreenProps } from '../../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkHero } from '../../../components/ui/DarkHero';
import { EmptyStateCard } from '../../../components/ui/EmptyStateCard';
import { ScreenContainer } from '../../../components/ui/ScreenContainer';
import { useAppSession } from '../../../providers/AppSessionProvider';
import { colors } from '../../../theme/colors';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';
import { layout } from '../../../theme/layout';
import { fetchMyCreatedEvents } from '../../events/api';
import { formatEventDateTime, formatEventStatus } from '../../events/formatters';
import type { EventSummary } from '../../events/types';

type MyEventsScreenProps = AppTabScreenProps<'MyEvents'>;

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  upcoming:  { text: '#FFFFFF', bg: '#2563EB' },
  ongoing:   { text: '#FFFFFF', bg: '#059669' },
  completed: { text: '#FFFFFF', bg: '#475569' },
  cancelled: { text: '#FFFFFF', bg: '#DC2626' },
};

function resolveLiveEventStatus(event: Pick<EventSummary, 'status' | 'startsAt'>): EventSummary['status'] {
  if (event.status === 'cancelled' || event.status === 'completed') {
    return event.status;
  }

  const startsAtMs = Date.parse(event.startsAt);
  if (!Number.isFinite(startsAtMs)) {
    return event.status;
  }

  const nowMs = Date.now();
  if (nowMs < startsAtMs) {
    return 'upcoming';
  }

  const endOfEventDay = new Date(startsAtMs);
  endOfEventDay.setHours(23, 59, 59, 999);
  return nowMs <= endOfEventDay.getTime() ? 'ongoing' : 'completed';
}

function withResolvedStatus(event: EventSummary): EventSummary {
  const status = resolveLiveEventStatus(event);
  if (status === event.status) {
    return event;
  }

  return {
    ...event,
    status,
  };
}

function EventCard({
  event,
  index,
  onPress,
}: {
  event: EventSummary;
  index: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const statusStyle = STATUS_COLORS[event.status] ?? STATUS_COLORS.upcoming;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [20, 0] }) }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
        onPress={onPress}
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
              <Ionicons name="calendar" size={32} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {formatEventStatus(event.status)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>

          <View style={styles.cardMeta}>
            <View style={styles.cardMetaRow}>
              <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
              <Text style={styles.cardMetaText}>{formatEventDateTime(event.startsAt)}</Text>
            </View>
            <View style={styles.cardMetaRow}>
              <Ionicons name="location-outline" size={13} color="#94A3B8" />
              <Text style={styles.cardMetaText} numberOfLines={1}>{event.location}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.ticketsBadge}>
              <Ionicons name="people-outline" size={13} color="#FFFFFF" />
              <Text style={styles.ticketsBadgeText}>{event.remainingSlots} / {event.capacity} slots</Text>
            </View>
            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function MyEventsScreen({ navigation }: MyEventsScreenProps) {
  const { isGuest, profile, signOut } = useAppSession();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const fabAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(heroAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(fabAnim,  { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
    ]).start();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setEvents((current) => current.map(withResolvedStatus));
    }, 60_000);

    return () => clearInterval(intervalId);
  }, []);

  const loadMyEvents = useCallback(
    async (isRefresh = false) => {
      if (!profile) return;
      if (isRefresh) setIsRefreshing(true);
      else           setIsLoading(true);
      try {
        const { data, error } = await fetchMyCreatedEvents(profile.id);
        if (error) throw error;
        setEvents(data.map(withResolvedStatus));
        setErrorMessage(null);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load your events.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [profile],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isGuest && profile) {
        if (!hasFetched.current) {
          hasFetched.current = true;
          void loadMyEvents();
        } 
      }
    }, [isGuest, loadMyEvents, profile]),
  );

  const statsSlot = (
    <View style={styles.heroStats}>
      {[
        { label: 'Upcoming', value: events.filter(e => e.status === 'upcoming').length,  color: '#60A5FA' },
        { label: 'Ongoing',  value: events.filter(e => e.status === 'ongoing').length,   color: '#34D399' },
        { label: 'Done',     value: events.filter(e => e.status === 'completed').length, color: '#94A3B8' },
      ].map((s, i, arr) => (
        <View
          key={s.label}
          style={[styles.heroStatItem, i < arr.length - 1 && styles.heroStatBorder]}
        >
          <Text style={[styles.heroStatValue, { color: s.color }]}>{s.value}</Text>
          <Text style={styles.heroStatLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );

  // ── GUEST STATE ─────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <ScreenContainer bg={colors.bgDark} noPadding>
        <StatusBar style="light" />
        <View style={styles.guestContainer}>
          <View style={styles.guestIconWrap}>
            <Ionicons name="calendar" size={40} color="#60A5FA" />
          </View>
          <Text style={styles.guestTitle}>My Events</Text>
          <Text style={styles.guestSub}>
            Sign in to create and manage your campus events as an organizer.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.85 }]}
            onPress={() => void signOut()}
          >
            <View style={styles.guestBtnSurface}>
              <Text style={styles.guestBtnText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // ── AUTHENTICATED STATE ──────────────────────────────────────────────────────
  return (
    <ScreenContainer bg={colors.bgDark} noPadding>
      <StatusBar style="light" />

        <View style={styles.screen}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            overScrollMode="never"
            refreshControl={
              <RefreshControl
                onRefresh={() => {
                  hasFetched.current = false;
                  void loadMyEvents(true);
                }}
                refreshing={isRefreshing}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            <DarkHero
              avatarInitials={profile?.full_name?.slice(0, 1) ?? undefined}
              avatarUri={profile?.avatar_url ?? null}
              eyebrow="Organizer Dashboard"
              extraBottomInset={24}
              title="My Events"
              rightSlot={
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipCount}>{events.length}</Text>
                  <Text style={styles.heroChipLabel}>total</Text>
                </View>
              }
              bottomSlot={statsSlot}
            />

            <View style={styles.body}>
              <View style={styles.bodyHeader}>
                <Text style={styles.bodyTitle}>Published Events</Text>
                <Pressable
                  style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.88 }]}
                  onPress={() => navigation.navigate('CreateEvent')}
                >
                  <View style={styles.createBtnSurface}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.createBtnText}>New</Text>
                  </View>
                </Pressable>
              </View>

              {isLoading ? (
                <EmptyStateCard
                  body="Hang tight while we fetch your published events."
                  icon="hourglass-outline"
                  title="Loading your events…"
                />
              ) : errorMessage ? (
                <View>
                  <EmptyStateCard
                    body={errorMessage}
                    icon="cloud-offline-outline"
                    title="Couldn't load events"
                  />
                  <Pressable
                    style={styles.retryBtn}
                    onPress={() => {
                      hasFetched.current = false;
                      void loadMyEvents();
                    }}
                  >
                    <Text style={styles.retryText}>Try Again</Text>
                  </Pressable>
                </View>
              ) : events.length === 0 ? (
                <View>
                  <EmptyStateCard
                    body="Tap the button below to create your first campus event and start getting attendees."
                    icon="calendar-outline"
                    title="No events yet"
                  />
                </View>
              ) : (
                <View style={styles.list}>
                  {events.map((event, i) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      index={i}
                      onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                    />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>

      {!isLoading && (
        null
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Both dark — covers ScreenContainer's white SafeAreaView during mount
  keyboardWrap: { flex: 1, backgroundColor: colors.bgDark },
  screen: { backgroundColor: colors.bgDark, flex: 1 },

  scroll: { backgroundColor: 'transparent', flex: 1 },
  content: { flexGrow: 1 },

  // Hero chip
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 9,
    alignItems: 'center',
  },
  heroChipCount: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#FFFFFF' },
  heroChipLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#D6E4FA', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Stats
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.xl,
    paddingVertical: 14,
  },
  heroStatItem: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  heroStatValue: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  heroStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#D6E4FA', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Body
  body: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    gap: spacing.xl,
    marginTop: -12,
    minHeight: 500,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xl,
  },
  bodyHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  bodyTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#0F172A' },
  createBtn: { borderRadius: radius.full },
  createBtnSurface: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 42, gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
  },
  createBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },

  // Event card
  list: { gap: spacing.md },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: '#D7E3F4',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardImageWrap: { position: 'relative', height: 130 },
  cardImage: { width: '100%', height: '100%' },
  cardImageFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A63BC' },
  statusBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
  },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  cardBody: { padding: spacing.md, gap: 8 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0F172A', lineHeight: 24 },
  cardMeta: { gap: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  ticketsBadge: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.full,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ticketsBadgeText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  chevronWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center',
  },

  // Empty states
  retryBtn: {
    backgroundColor: '#EFF6FF', borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: spacing.md,
    alignSelf: 'center',
  },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },
  // Guest
  guestContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH, gap: 16,
    backgroundColor: colors.bgDark,
  },
  guestIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#E8F1FF',
    borderWidth: 1, borderColor: '#CDE0FB',
    alignItems: 'center', justifyContent: 'center',
  },
  guestTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#fff', letterSpacing: -0.5 },
  guestSub: { fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#CBD5E1',
    textAlign: 'center',},
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
});