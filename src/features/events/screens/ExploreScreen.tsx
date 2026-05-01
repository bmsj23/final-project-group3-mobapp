import { useFocusEffect } from '@react-navigation/native';
import type { AppTabScreenProps } from '../../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { DarkHero } from '../../../components/ui/DarkHero';
import { EmptyStateCard } from '../../../components/ui/EmptyStateCard';
import { ScreenContainer } from '../../../components/ui/ScreenContainer';
import { useEventFavorites } from '../FavoritesProvider';
import { useAppSession } from '../../../providers/AppSessionProvider';
import { colors } from '../../../theme/colors';
import { layout } from '../../../theme/layout';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';
import { fetchCategories, fetchUpcomingEvents } from '../api';
import { CategoryPill } from '../components/CategoryPill';
import { EventListCard } from '../components/EventListCard';
import { filterEventsByQuery } from '../formatters';
import type { EventCategorySummary, EventSummary } from '../types';

type ExploreScreenProps = AppTabScreenProps<'Explore'>;

export function ExploreScreen({ navigation }: ExploreScreenProps) {
  const { isGuest, profile } = useAppSession();
  const { isFavorited, refreshFavorites, toggleFavorite } = useEventFavorites();
  const [categories, setCategories] = useState<EventCategorySummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedModalVisible, setSavedModalVisible] = useState(false);
  const [removedModalVisible, setRemovedModalVisible] = useState(false);
  const hasFetched = useRef(false);

  const loadExplore = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [{ data: nextCategories, error: categoriesError }, { data: nextEvents, error: eventsError }] =
        await Promise.all([fetchCategories(), fetchUpcomingEvents()]);

      if (categoriesError) throw categoriesError;
      if (eventsError) throw eventsError;

      setCategories(nextCategories);
      setEvents(nextEvents);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load explore data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasFetched.current) {
        hasFetched.current = true;
        void loadExplore();
      }
      if (!isGuest && profile?.id) {
        void refreshFavorites();
      }
    }, [isGuest, loadExplore, profile?.id, refreshFavorites]),
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
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const filteredEvents = useMemo(() => {
    const searchedEvents = filterEventsByQuery(events, query, categoryNameById);
    return searchedEvents.filter((event) => !selectedCategoryId || event.categoryId === selectedCategoryId);
  }, [categoryNameById, events, query, selectedCategoryId]);

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
            bounces={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            overScrollMode="never"
            refreshControl={
              <RefreshControl
                onRefresh={() => void loadExplore(true)}
                refreshing={isRefreshing}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            <DarkHero
              eyebrow="Discover"
              extraBottomInset={24}
              title="Find your next event"
              rightSlot={<Ionicons color="#93C5FD" name="compass" size={24} />}
              bottomSlot={
                <View style={styles.searchBar}>
                  <Ionicons color="#94A3B8" name="search" size={18} />
                  <TextInput
                    autoCorrect={false}
                    onChangeText={setQuery}
                    placeholder="Find amazing events"
                    placeholderTextColor="#94A3B8"
                    style={styles.heroInput}
                    value={query}
                  />
                </View>
              }
            />

            <View style={styles.body}>
              <View style={styles.inner}>
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
                      label="All"
                      onPress={() => setSelectedCategoryId(null)}
                      selected={selectedCategoryId === null}
                    />
                    {categories.map((category) => (
                      <CategoryPill
                        key={category.id}
                        label={category.name}
                        onPress={() => setSelectedCategoryId(category.id)}
                        selected={selectedCategoryId === category.id}
                      />
                    ))}
                  </View>
                </ScrollView>

                {filteredEvents.length > 0 && !isLoading && !errorMessage ? (
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
                ) : (
                  <View style={styles.stateWrap}>
                    {errorMessage ? (
                      <EmptyStateCard body={errorMessage} icon="cloud-offline-outline" title="Unable to load explore data" />
                    ) : isLoading ? (
                      <EmptyStateCard body="Loading events and categories for you." icon="hourglass-outline" title="Loading explore" />
                    ) : (
                      <EmptyStateCard body="Try a different search or clear the current category filter." icon="search-outline" title="No matching events" />
                    )}
                  </View>
                )}
              </View>
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
  heroInput: {
    color: colors.textLight,
    flex: 1,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
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
  fullBleedScroll: {
    flex: 0,
    marginHorizontal: -layout.screenPaddingH,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingLeft: layout.screenPaddingH,
    paddingRight: layout.screenPaddingH,
  },
  list: {
    gap: spacing.md,
  },
  stateWrap: {
    alignSelf: 'stretch',
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