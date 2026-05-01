import { useFocusEffect } from '@react-navigation/native';
import type { AppTabScreenProps } from '../../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
      await toggleFavorite(eventId);
    } catch (error) {
      Alert.alert('Unable to save event', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [toggleFavorite]);

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
});