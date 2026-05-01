import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppSession } from '../../../providers/AppSessionProvider';
import type { AppStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';
import { layout } from '../../../theme/layout';
import { notifyEventCreated } from '../../notifications/service';
import { createEvent, deleteEventImage, deleteOwnEvent, fetchCategories, saveEventImages, updateOwnEvent, uploadEventImage } from '../api';
import { EventForm, type EventFormSubmission } from '../components/EventForm';
import { createEmptyEventFormValues } from '../form';
import type { EventCategorySummary } from '../types';

type CreateEventScreenProps = NativeStackScreenProps<AppStackParamList, 'CreateEvent'>;

const INITIAL_VALUES = createEmptyEventFormValues();

const STEP_META = [
  { label: 'Details',  sub: 'Name, category & description' },
  { label: 'Schedule', sub: 'Date, time & deadline'        },
  { label: 'Review',   sub: 'Preview & publish'            },
];

export function CreateEventScreen({ navigation }: CreateEventScreenProps) {
  const { isAuthenticated, isGuest, profile, signOut } = useAppSession();
  const [categories, setCategories]           = useState<EventCategorySummary[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [screenError, setScreenError]         = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [currentStep, setCurrentStep]         = useState(0);
  const [isDirty, setIsDirty]                 = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successEventId, setSuccessEventId]   = useState<string | null>(null);
  const isDirtyRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const handleDescriptionFocus = useCallback(() => {
    if (Platform.OS === 'ios') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
    }
  }, []);

  const heroAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heroAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await fetchCategories();
      if (error) throw error;
      setCategories(data);
      setScreenError(null);
    } catch (err) {
      setScreenError(err instanceof Error ? err.message : 'Unable to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadCategories(); }, [loadCategories]);

  // Keep ref in sync with state so handleBack always reads the latest value
  const handleDirtyChange = useCallback((value: boolean) => {
    isDirtyRef.current = value;
    setIsDirty(value);
  }, []);

  // Replace beforeRemove — intercept back manually
  const handleBack = useCallback(() => {
    if (!isDirtyRef.current) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. Are you sure you want to leave without publishing this event?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  }, [navigation]);

  const handleSubmit = useCallback(
    async ({ selectedImages, values }: EventFormSubmission) => {
      if (!profile) { setSubmissionError('Account setup required.'); return; }
      setIsSubmitting(true);
      setSubmissionError(null);
      let createdEventId: string | null = null;
      let shouldRollback = true;
      const uploadedImages: Array<{ path: string; publicUrl: string }> = [];
      try {
        const { data, error } = await createEvent(profile.id, { ...values, coverImageUrl: null });
        if (error || !data) {
          throw error ?? new Error('Unable to create event.');
        }
        createdEventId = data.id;

        if (selectedImages.length > 0) {
          for (const image of selectedImages) {
            const { data: uploadData, error: uploadError } = await uploadEventImage(profile.id, image);
            if (uploadError || !uploadData) {
              throw uploadError ?? new Error('Image upload failed.');
            }

            uploadedImages.push(uploadData);
          }

          const imageUrls = uploadedImages.map((image) => image.publicUrl);
          const { error: imageSaveError } = await saveEventImages(data.id, imageUrls);
          if (imageSaveError) {
            throw imageSaveError;
          }

          const { error: coverUpdateError } = await updateOwnEvent(data.id, {
            ...values,
            coverImageUrl: imageUrls[0] ?? null,
          });
          if (coverUpdateError) {
            throw coverUpdateError;
          }
        }

        shouldRollback = false;
        await notifyEventCreated(values.title.trim());
        setSuccessEventId(data.id);
        setShowSuccessModal(true);
      } catch (err) {
        if (shouldRollback) {
          for (const image of uploadedImages) {
            await deleteEventImage(image.path);
          }

          if (createdEventId) {
            await deleteOwnEvent(createdEventId);
          }
        }

        setSubmissionError(err instanceof Error ? err.message : 'Unable to create event.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigation, profile],
  );

  const handleSuccessModalOk = useCallback(() => {
    if (!successEventId) return;
    setShowSuccessModal(false);
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Tabs', params: { screen: 'MyEvents' } },
        { name: 'EventDetail', params: { eventId: successEventId } },
      ],
    });
  }, [navigation, successEventId]);

  // ── Guest ──────────────────────────────────────────────────────────────
  if (!isAuthenticated || isGuest) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <View style={[styles.stateIcon, { backgroundColor: 'rgba(148,163,184,0.1)' }]}>
            <Ionicons name="lock-closed" size={28} color="#94A3B8" />
          </View>
          <Text style={styles.stateTitle}>Sign in required</Text>
          <Text style={styles.stateSub}>Organizer tools are only available for signed-in accounts.</Text>
          <Pressable style={styles.stateBtn} onPress={() => void signOut()}>
            <Text style={styles.stateBtnText}>Return to Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.stateTitle}>Loading categories…</Text>
          <Text style={styles.stateSub}>Preparing your event creation form.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (screenError) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <View style={[styles.stateIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="cloud-offline-outline" size={28} color="#EF4444" />
          </View>
          <Text style={styles.stateTitle}>Couldn't load categories</Text>
          <Text style={styles.stateSub}>{screenError}</Text>
          <Pressable style={styles.stateBtn} onPress={() => void loadCategories()}>
            <Text style={styles.stateBtnText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <StatusBar style="light" />
      <LinearGradient colors={['#060D1F', '#0F1E3D', '#060D1F']} style={StyleSheet.absoluteFill} />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        bounces={false} overScrollMode="never"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        contentContainerStyle={styles.scroll}
      >
          {/* ── Hero ── */}
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: heroAnim,
                transform: [{ translateY: heroAnim.interpolate({ inputRange:[0,1], outputRange:[-20,0] }) }],
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              {/* Back button now calls handleBack instead of navigation.goBack() */}
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                onPress={handleBack}
              >
                <Ionicons name="chevron-back" size={20} color="#CBD5E1" />
              </Pressable>
            </View>
            <Text style={styles.heroEyebrow}>Organizer Tools</Text>
            <Text style={styles.heroTitle}>Create New Event</Text>
            <Text style={styles.heroSub}>
              Fill in the details below to publish your event to campus attendees.
            </Text>
          </Animated.View>

          {/* ── White form sheet ── */}
          <View style={styles.formSheet}>
            <View style={styles.formHandle} />
            <EventForm
              categories={categories}
              errorMessage={submissionError}
              initialValues={INITIAL_VALUES}
              isSubmitting={isSubmitting}
              onStepChange={setCurrentStep}
              onSubmit={handleSubmit}
              onDescriptionFocus={handleDescriptionFocus}
              onDirtyChange={handleDirtyChange}
              resetKey="create-event"
              submitLabel={isSubmitting ? 'Creating Event…' : 'Publish Event'}
            />
          </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (showSuccessModal) {
            handleSuccessModalOk();
          }
        }}
        transparent
        visible={showSuccessModal}
      >
        <View style={styles.successModalBackdrop}>
          <View style={styles.successModalCard}>
            <View style={styles.successModalIconWrap}>
              <Ionicons name="checkmark" size={22} color="#16A34A" />
            </View>
            <Text style={styles.successModalTitle}>Event published</Text>
            <Text style={styles.successModalMessage}>Your event is now live and visible to all attendees.</Text>
            <Pressable
              style={({ pressed }) => [styles.successModalOkBtn, pressed && { opacity: 0.88 }]}
              onPress={handleSuccessModalOk}
            >
              <Text style={styles.successModalOkBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#060D1F' },
  scroll: { flexGrow: 1, paddingBottom: 0 },
  scrollView: { flex: 1 },

  centerState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH, gap: 12,
  },
  stateIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  stateTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#F1F5F9', textAlign: 'center' },
  stateSub:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 20 },
  stateBtn: {
    backgroundColor: 'rgba(37,99,235,0.18)', borderRadius: radius.full,
    paddingHorizontal: 22, paddingVertical: 11, marginTop: 4,
  },
  stateBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#60A5FA' },

  hero: {
    paddingTop: 52, paddingHorizontal: layout.screenPaddingH, paddingBottom: 16,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBadge: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: {
    fontFamily: 'Inter_500Medium', fontSize: 12,
    color: '#C7DAF8', letterSpacing: 0.5, marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold', fontSize: 28,
    color: '#F1F5F9', letterSpacing: -0.5, marginBottom: 6,
  },
  heroSub: {
    fontFamily: 'Inter_400Regular', fontSize: 14,
    color: '#94A3B8', lineHeight: 21, marginBottom: 20,
  },
  stepTracker: { gap: spacing.xs },
  stepCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.md, padding: 12,
  },
  stepCardActive: { backgroundColor: 'rgba(37,99,235,0.14)', borderColor: 'rgba(37,99,235,0.32)' },
  stepCardDone:   { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' },
  stepBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepBadgeDone:   { backgroundColor: '#10B981', borderColor: '#10B981' },
  stepNum:         { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569' },
  stepInfo:        { flex: 1 },
  stepLabel:       { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#334155' },
  stepLabelActive: { color: '#93C5FD' },
  stepLabelDone:   { color: '#6EE7B7' },
  stepSub:         { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#334155', marginTop: 1 },
  activeArrow:     { paddingLeft: 4 },
  doneCheck:       { paddingLeft: 4 },

  formSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    padding: spacing.lg, paddingTop: 16, paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 16,
  },
  formHandle: {
    width: 0, height: 0, borderRadius: 3,
    backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 0,
  },

  successModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 10,
  },
  successModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  successModalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
  },
  successModalMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },
  successModalOkBtn: {
    marginTop: 6,
    minWidth: 110,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalOkBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
