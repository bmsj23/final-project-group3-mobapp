import { useFocusEffect } from '@react-navigation/native';
import type { AppTabScreenProps } from '../../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkHero } from '../../../components/ui/DarkHero';
import { EmptyStateCard } from '../../../components/ui/EmptyStateCard';
import { ScreenContainer } from '../../../components/ui/ScreenContainer';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { useEventFavorites } from '../FavoritesProvider';
import { useAppSession } from '../../../providers/AppSessionProvider';
import { colors } from '../../../theme/colors';
import { layout } from '../../../theme/layout';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { fetchCategories, fetchUpcomingEvents } from '../api';
import { CategoryPill } from '../components/CategoryPill';
import { EventListCard } from '../components/EventListCard';
import { filterEventsByQuery } from '../formatters';
import type { EventCategorySummary, EventSummary } from '../types';

type HomeScreenProps = AppTabScreenProps<'Home'>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { isGuest, profile } = useAppSession();
  const { isFavorited, refreshFavorites, toggleFavorite } = useEventFavorites();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [categories, setCategories] = useState<EventCategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedModalVisible, setSavedModalVisible] = useState(false);
  const [removedModalVisible, setRemovedModalVisible] = useState(false);
  const hasFetched = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const categoriesY = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: bodyY.current + categoriesY.current, animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedCategoryId]);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const [{ data: nextEvents, error: eventsError }, { data: nextCategories, error: categoriesError }] =
        await Promise.all([fetchUpcomingEvents(), fetchCategories()]);
      if (eventsError) throw eventsError;
      if (categoriesError) throw categoriesError;
      setEvents(nextEvents);
      setCategories(nextCategories);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load the home feed.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasFetched.current) {
        hasFetched.current = true;
        void loadFeed();
      }
      if (!isGuest && profile?.id) {
        void refreshFavorites();
      }
    }, [isGuest, loadFeed, profile?.id, refreshFavorites]),
  );

  const handleToggleFavorite = useCallback(async (eventId: string) => {
    try {
      const wasAlreadySaved = isFavorited(eventId);
      await toggleFavorite(eventId);
      if (!wasAlreadySaved) {
        setSavedModalVisible(true);
      } else {
        setRemovedModalVisible(true);
      }
    } catch (error) {
      Alert.alert('Unable to save event', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [isFavorited, toggleFavorite]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const filteredEvents = useMemo(() => filterEventsByQuery(events, query, categoryNameById), [categoryNameById, events, query]);
  const featuredEvents = events.slice(0, 4);
  const listEvents = useMemo(() => {
    if (!selectedCategoryId) return events.slice(0, 8);
    return events.filter((e) => e.categoryId === selectedCategoryId);
  }, [events, selectedCategoryId]);
  const topCategories = categories.slice(0, 5);
  const isSearching = query.trim().length > 0;

  return (
    <ScreenContainer bg={colors.bgDark} noPadding>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'height' : undefined} style={styles.keyboardWrap}>
        <View style={styles.screen}>
          <Modal
            animationType="fade"
            onRequestClose={() => setSavedModalVisible(false)}
            transparent
            visible={savedModalVisible}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="heart" size={22} color="#16A34A" />
                </View>
                <Text style={styles.modalTitle}>Event saved!</Text>
                <Text style={styles.modalMessage}>This event has been added to your saved list.</Text>
                <Pressable
                  style={({ pressed }) => [styles.modalOkBtn, pressed && { opacity: 0.88 }]}
                  onPress={() => setSavedModalVisible(false)}
                >
                  <Text style={styles.modalOkBtnText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
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
            ref={scrollRef}
            bounces={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            overScrollMode="never"
            refreshControl={
              <RefreshControl
                onRefresh={() => void loadFeed(true)}
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
              eyebrow={profile?.full_name ? 'Hi Welcome' : 'Explore Events'}
              extraBottomInset={24}
              onPressAvatar={() => navigation.navigate('Profile')}
              title={profile?.full_name ?? 'Eventure'}
              bottomSlot={
                <View style={styles.searchBar}>
                  <Ionicons color="#94A3B8" name="search" size={18} />
                  <TextInput
                    autoCorrect={false}
                    onChangeText={setQuery}
                    placeholder="Search by event, place, or category"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="search"
                    style={styles.searchInput}
                    value={query}
                  />
                  {query ? (
                    <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.searchActionButton}>
                      <Ionicons color={colors.textLight} name="close" size={16} />
                    </Pressable>
                  ) : null}
                </View>
              }
            />
            <View style={styles.body} onLayout={(e) => { bodyY.current = e.nativeEvent.layout.y; }}>
              {errorMessage ? (
                <EmptyStateCard
                  body={errorMessage}
                  icon="cloud-offline-outline"
                  title="Unable to load events"
                />
              ) : isLoading ? (
                <EmptyStateCard
                  body="Loading the latest events for your feed."
                  icon="hourglass-outline"
                  title="Loading events"
                />
              ) : isSearching ? (
                <>
                  <SectionHeader title="Search Results" />
                  {filteredEvents.length === 0 ? (
                    <EmptyStateCard
                      body="Try another keyword or clear the search field to browse everything again."
                      icon="search-outline"
                      title="No matching events"
                    />
                  ) : (
                    <View style={styles.list}>
                      {filteredEvents.map((event) => (
                        <EventListCard
                          key={event.id}
                          categoryName={categoryNameById.get(event.categoryId)}
                          event={event}
                          isFavorited={isFavorited(event.id)}
                          onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                          onToggleFavorite={() => void handleToggleFavorite(event.id)}
                        />
                      ))}
                    </View>
                  )}
                </>
              ) : featuredEvents.length === 0 ? (
                <EmptyStateCard
                  body="Create your first event or check back later."
                  icon="calendar-outline"
                  title="No upcoming events yet"
                />
              ) : (
                <>
                  <SectionHeader
                    actionLabel="VIEW ALL"
                    onPressAction={() => navigation.navigate('Explore')}
                    title="Featured Events"
                  />
                  <ScrollView
                    alwaysBounceHorizontal={false}
                    bounces={false}
                    horizontal
                    overScrollMode="never"
                    showsHorizontalScrollIndicator={false}
                    style={styles.fullBleedScroll}
                  >
                    <View style={styles.featuredRow}>
                      {featuredEvents.map((event) => (
                        <EventListCard
                          key={event.id}
                          categoryName={categoryNameById.get(event.categoryId)}
                          event={event}
                          isFavorited={isFavorited(event.id)}
                          onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                          onToggleFavorite={() => void handleToggleFavorite(event.id)}
                          variant="featured"
                        />
                      ))}
                    </View>
                  </ScrollView>
                  <View onLayout={(e) => { categoriesY.current = e.nativeEvent.layout.y; }}>
                    <SectionHeader
                      actionLabel="VIEW ALL"
                      onPressAction={() => navigation.navigate('Explore')}
                      title="Browse Categories"
                    />
                  </View>
                  <ScrollView
                    alwaysBounceHorizontal={false}
                    bounces={false}
                    horizontal
                    overScrollMode="never"
                    showsHorizontalScrollIndicator={false}
                    style={styles.fullBleedScroll}
                  >
                    <View style={styles.categoryRow}>
                      <CategoryPill
                        key="all"
                        label="All"
                        onPress={() => setSelectedCategoryId(null)}
                        selected={selectedCategoryId === null}
                      />
                      {topCategories.map((category) => (
                        <CategoryPill
                          key={category.id}
                          label={category.name}
                          onPress={() => setSelectedCategoryId(prev => prev === category.id ? null : category.id)}
                          selected={selectedCategoryId === category.id}
                        />
                      ))}
                    </View>
                  </ScrollView>
                  {listEvents.length === 0 && selectedCategoryId !== null ? (
                    <EmptyStateCard
                      body="No events found in this category yet. Check back later."
                      icon="calendar-outline"
                      title="No events here"
                    />
                  ) : (
                    <View style={styles.list}>
                      {listEvents.map((event) => (
                        <EventListCard
                          key={event.id}
                          categoryName={categoryNameById.get(event.categoryId)}
                          event={event}
                          onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.bgDark,
    flex: 1,
  },
  scroll: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xl,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    ...typography.body2,
    color: '#CBD5E1',
    flex: 1,
    marginLeft: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  searchActionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  body: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    gap: spacing.xl,
    marginTop: -12,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xl,
  },
  fullBleedScroll: {
    marginHorizontal: -layout.screenPaddingH,
  },
  featuredRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.xl,
    paddingLeft: layout.screenPaddingH,
    paddingRight: layout.screenPaddingH,
    paddingTop: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingLeft: layout.screenPaddingH,
    paddingRight: layout.screenPaddingH,
  },
  list: {
    gap: spacing.md,
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