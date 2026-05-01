import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../theme/colors';
import { radius } from '../../../theme/radius';
import { shadows } from '../../../theme/shadows';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { formatEventDateTime, capitalizeLocation } from '../formatters';
import type { EventSummary } from '../types';

type EventListCardProps = {
  event: EventSummary;
  categoryName?: string;
  onPress?: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  variant?: 'featured' | 'compact';
};

const AVATAR_PLACEHOLDER_COLORS = ['#DBEAFE', '#EDE9FE', '#FCE7F3'];

function MemberAvatarStack({ joined }: { joined: number }) {
  const visibleCount = Math.min(joined, 3);
  return (
    <View style={stackStyles.row}>
      <View style={stackStyles.avatars}>
        {Array.from({ length: visibleCount }, (_, i) => (
          <View
            key={i}
            style={[
              stackStyles.avatar,
              { backgroundColor: AVATAR_PLACEHOLDER_COLORS[i % AVATAR_PLACEHOLDER_COLORS.length] },
              i > 0 && stackStyles.avatarOverlap,
            ]}
          />
        ))}
      </View>
      <Text style={stackStyles.label}>{joined} Members joined</Text>
    </View>
  );
}

const stackStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    borderColor: colors.bgCard,
    borderRadius: radius.full,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  label: {
    ...typography.caption4,
    color: colors.textMuted,
  },
});

export function EventListCard({
  categoryName,
  event,
  isFavorited = false,
  onPress,
  onToggleFavorite,
  variant = 'compact',
}: EventListCardProps) {
  const joinedCount = event.capacity - event.remainingSlots;

  return (
    <View style={[styles.shadowWrap, variant === 'featured' ? styles.featuredCard : null]}>
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={[styles.card, variant === 'featured' ? styles.featuredCardInner : styles.compactCard]}
    >
      {variant === 'featured' ? (
        <>
          <Image
            contentFit="cover"
            source={event.coverImageUrl ? { uri: event.coverImageUrl } : undefined}
            style={styles.featuredImage}
            transition={150}
          />
          <Pressable
            disabled={!onToggleFavorite}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              onToggleFavorite?.();
            }}
            style={styles.favouriteBadge}
          >
            <Ionicons
              color={isFavorited ? colors.error : colors.textMuted}
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={16}
            />
          </Pressable>
          <View style={styles.featuredBody}>
            <View style={styles.featuredTop}>
              <Text numberOfLines={2} style={styles.featuredTitle}>
                {event.title}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="calendar-outline" size={12} />
                <Text style={styles.meta}>{formatEventDateTime(event.startsAt)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="location-outline" size={12} />
                <Text numberOfLines={1} style={styles.meta}>{capitalizeLocation(event.location)}</Text>
              </View>
            </View>
            <View style={styles.featuredFooter}>
              <MemberAvatarStack joined={joinedCount} />
              <View style={styles.joinButton}>
                <Text style={styles.joinButtonText}>JOIN NOW</Text>
              </View>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.compactRow}>
          <Image
            contentFit="cover"
            source={event.coverImageUrl ? { uri: event.coverImageUrl } : undefined}
            style={styles.compactImage}
          />
          <View style={styles.compactBody}>
            {categoryName ? <Text style={styles.categoryText}>{categoryName.toUpperCase()}</Text> : null}
            <Text numberOfLines={1} style={styles.compactTitle}>
              {event.title}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons color={colors.textMuted} name="calendar-outline" size={12} />
              <Text numberOfLines={1} style={styles.meta}>{formatEventDateTime(event.startsAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons color={colors.textMuted} name="location-outline" size={12} />
              <Text numberOfLines={1} style={styles.meta}>{capitalizeLocation(event.location)}</Text>
            </View>
          </View>
          <View style={styles.trailingColumn}>
            {onToggleFavorite ? (
              <Pressable
                accessibilityLabel={isFavorited ? 'Remove from saved' : 'Save event'}
                onPress={(pressEvent) => {
                  pressEvent.stopPropagation();
                  onToggleFavorite();
                }}
                style={styles.compactFavoriteBtn}
              >
                <Ionicons
                  color={isFavorited ? colors.error : colors.textMuted}
                  name={isFavorited ? 'heart' : 'heart-outline'}
                  size={16}
                />
              </Pressable>
            ) : null}
            <Text style={styles.spotsText}>{event.remainingSlots} spots</Text>
            <View style={styles.joinButton}>
              <Text style={styles.joinButtonText}>JOIN</Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 5,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  featuredCardInner: {
    flex: 1,
  },
  featuredCard: {
    width: 292,
    height: 340,
  },
  compactCard: {
    padding: spacing.md,
  },
  featuredImage: {
    backgroundColor: '#DBEAFE',
    height: 170,
    width: '100%',
  },
  favouriteBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.full,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 34,
  },
  featuredBody: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  featuredTop: {
    gap: spacing.xs,
  },
  featuredTitle: {
    ...typography.h5,
    color: colors.text,
    fontSize: 21,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  meta: {
    ...typography.caption2,
    color: colors.textMuted,
  },
  featuredFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  joinButtonText: {
    ...typography.caption3,
    color: colors.textLight,
  },
  compactRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  compactImage: {
    backgroundColor: '#DBEAFE',
    borderRadius: radius.md,
    height: 80,
    width: 80,
  },
  compactBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  categoryText: {
    ...typography.caption4,
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  compactTitle: {
    ...typography.button1,
    color: colors.text,
    fontSize: 16,
  },
  trailingColumn: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  compactFavoriteBtn: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.full,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  spotsText: {
    ...typography.caption3,
    color: colors.primary,
  },
});
