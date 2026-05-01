import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { layout } from '../../theme/layout';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type DarkHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  avatarUri?: string | null;
  avatarInitials?: string;
  onPressAvatar?: () => void;
  rightSlot?: ReactNode;
  bottomSlot?: ReactNode;
  extraBottomInset?: number;
};

const AVATAR_SIZE = 52;

export function DarkHero({
  eyebrow,
  title,
  subtitle,
  avatarUri,
  avatarInitials,
  onPressAvatar,
  rightSlot,
  bottomSlot,
  extraBottomInset = 0,
}: DarkHeroProps) {
  const insets = useSafeAreaInsets();
  const showAvatar = Boolean(avatarUri ?? avatarInitials);

  return (
    <LinearGradient
      colors={[colors.gradient.blackLinear.start, colors.gradient.blackLinear.end]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[
        styles.hero,
        {
          marginBottom: -extraBottomInset,
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.xl + extraBottomInset,
        },
      ]}
    >
      <View style={styles.topRow}>
        {showAvatar ? (
          <Pressable
            accessibilityLabel="Go to profile"
            onPress={onPressAvatar}
            style={styles.avatarWrapper}
          >
            {avatarUri ? (
              <Image
                contentFit="cover"
                source={{ uri: avatarUri }}
                style={styles.avatar}
                transition={150}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitialsText}>
                  {(avatarInitials ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </Pressable>
        ) : null}
        <View style={styles.copy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      {bottomSlot ? <View style={styles.bottomSlot}>{bottomSlot}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    paddingHorizontal: layout.screenPaddingH,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  avatarWrapper: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatar: {
    borderColor: colors.primaryDark,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: colors.primaryDeep,
    justifyContent: 'center',
  },
  avatarInitialsText: {
    ...typography.h5,
    color: colors.textLight,
  },
  onlineDot: {
    backgroundColor: colors.success,
    borderColor: colors.bgDark,
    borderRadius: 7,
    borderWidth: 2,
    bottom: 2,
    height: 13,
    position: 'absolute',
    right: 2,
    width: 13,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.caption4,
    color: colors.textMuted,
  },
  title: {
    ...typography.h4,
    color: colors.textLight,
  },
  subtitle: {
    ...typography.body2,
    color: '#CBD5E1',
  },
  rightSlot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bottomSlot: {
    marginTop: spacing.lg,
  },
});
