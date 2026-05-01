import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '../../../constants/app';
import type { AuthStackParamList } from '../../../navigation/types';
import { useAppSession } from '../../../providers/AppSessionProvider';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';

type WelcomeScreenProps = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const STATS = [
  { value: '240+', label: 'events' },
  { value: '5k+', label: 'people' },
  { value: '24/7', label: 'energy' },
];

export function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { continueAsGuest } = useAppSession();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const sheetY = useRef(new Animated.Value(80)).current;
  const sheetOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sheetOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]),
    ]).start();
  }, [fadeIn, slideUp, sheetOp, sheetY]);

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <LinearGradient
        colors={['#0B1733', '#12305D', '#1D4E89', '#3B82C4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.hero, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <View style={styles.heroTop}>
          <Text style={styles.logoText}>{APP_NAME.toUpperCase()}</Text>

          <View style={styles.headlineBlock}>
            <Text style={styles.h1}>YOUR NEXT</Text>
            <View style={styles.h2Row}>
              <View style={styles.strokeWrap}>
                <Text style={[styles.h2StrokeBase, styles.h2StrokeOutline]}>EVENT</Text>
              </View>
              <Text style={styles.h2Solid}> IS</Text>
            </View>
            <Text style={styles.h3Accent}>RIGHT HERE</Text>
          </View>

          <Text style={styles.subcopy}>
            Discover campus moments, last-minute plans, and the events everyone is about to post on
            their story.
          </Text>
        </View>

        <View style={styles.statsWrap}>
          <View style={styles.statsRow}>
            {STATS.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.sheet, { opacity: sheetOp, transform: [{ translateY: sheetY }] }]}>
        <Text style={styles.sheetEyebrow}>discover . book . vibe</Text>
        <Text style={styles.sheetHeadline}>
          Campus events,{'\n'}
          <Text style={styles.sheetHeadlineAccent}>Made for your era.</Text>
        </Text>

        <View style={styles.btnStack}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.86 }]}
            onPress={() => navigation.navigate('SignIn')}
          >
            <View style={styles.btnPrimaryFill}>
              <Text style={styles.btnPrimaryText}>Sign In</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.78 }]}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.btnOutlineText}>Create Account</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.55 }]}
          onPress={() => void continueAsGuest()}
        >
          <Text style={styles.btnGhostText}>Just browsing</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  hero: {
    flex: 1,
    paddingTop: 84,
    paddingHorizontal: spacing.xl,
    paddingBottom: 32,
    justifyContent: 'flex-start',
  },
  heroTop: {
    gap: 22,
    paddingTop: 20,
  },
  logoText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#F0F9FF',
    letterSpacing: 4,
  },
  headlineBlock: {
    marginTop: -2,
  },
  h1: {
    fontFamily: 'Inter_700Bold',
    fontSize: 64,
    lineHeight: 70,
    color: '#FFFFFF',
    letterSpacing: -2.6,
  },
  h2Row: { flexDirection: 'row', alignItems: 'baseline' },
  strokeWrap: { position: 'relative' },
  h2StrokeBase: {
    fontFamily: 'Inter_700Bold',
    fontSize: 64,
    lineHeight: 74,
    letterSpacing: -2.6,
  },
  h2StrokeOutline: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  h2StrokeFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: '#020617',
  },
  h2Solid: {
    fontFamily: 'Inter_700Bold',
    fontSize: 64,
    lineHeight: 74,
    color: '#FFFFFF',
    letterSpacing: -2.6,
  },
  h3Accent: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 34,
    color: '#DBEAFE',
    letterSpacing: -0.7,
    marginTop: 4,
  },
  subcopy: {
    maxWidth: '92%',
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    lineHeight: 28,
    color: '#E2E8F0',
    marginTop: 0,
    marginBottom: 20,
  },
  statsWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'center',
    width: '100%',
  },
  statCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 22,
    backgroundColor: '#0f172ab8',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.22)',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#BFDBFE',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.xl,
    paddingTop: 28,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1E3A8A',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#0F172A',
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  sheetHeadline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 32,
    color: '#0F172A',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  sheetHeadlineAccent: {
    color: '#0F172A',
  },
  btnStack: { gap: 14, marginBottom: 14 },
  btnPrimary: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  btnPrimaryFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    backgroundColor: '#0f172a',
  },
  btnPrimaryText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  btnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,246,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    borderRadius: radius.md,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: 'rgba(15,23,42,0.18)',
  },
  btnOutlineText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  btnGhost: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  btnGhostText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#0F172A',
    letterSpacing: 0.2,
  },
});
