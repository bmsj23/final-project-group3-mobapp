import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  deleteEventImage,
  deleteEventImageFromPublicUrl,
  fetchCategories,
  fetchEventById,
  replaceEventImages,
  updateOwnEvent,
  uploadEventImage,
} from '../api';
import { EventForm, type EventFormSubmission } from '../components/EventForm';
import { mapEventDetailToFormValues } from '../form';
import type { EventCategorySummary, EventDetail } from '../types';

type EditEventScreenProps = NativeStackScreenProps<AppStackParamList, 'EditEvent'>;

export function EditEventScreen({ navigation, route }: EditEventScreenProps) {
  const { isAuthenticated, isGuest, profile, signOut } = useAppSession();
  const [event, setEvent]                     = useState<EventDetail | null>(null);
  const [categories, setCategories]           = useState<EventCategorySummary[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [screenError, setScreenError]         = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const isDirtyRef = useRef(false);

  const scrollRef = useRef<ScrollView | null>(null);
  const handleDescriptionFocus = useCallback(() => {
    if (Platform.OS === 'ios') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
    }
  }, []);

  const initialValues = useMemo(
    () => (event ? mapEventDetailToFormValues(event) : null),
    [event],
  );

  const heroAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heroAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const loadEditorData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: nextEvent, error: eventError }, { data: nextCats, error: catError }] =
        await Promise.all([fetchEventById(route.params.eventId), fetchCategories()]);
      if (eventError) throw eventError;
      if (catError) throw catError;
      if (!nextEvent) throw new Error('Event not found or has been deleted.');
      setEvent(nextEvent);
      setCategories(nextCats);
      setScreenError(null);
    } catch (err) {
      setScreenError(err instanceof Error ? err.message : 'Unable to load this event for editing.');
    } finally {
      setIsLoading(false);
    }
  }, [route.params.eventId]);

  useEffect(() => { void loadEditorData(); }, [loadEditorData]);

  // Keep ref in sync — no state needed, ref is always current
  const handleDirtyChange = useCallback((value: boolean) => {
    isDirtyRef.current = value;
  }, []);

  // Replace beforeRemove — intercept back manually
  const handleBack = useCallback(() => {
    if (!isDirtyRef.current) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. Are you sure you want to leave without saving?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  }, [navigation]);

  const handleSubmit = useCallback(
    async ({ existingImageUrls, selectedImages, values }: EventFormSubmission) => {
      if (!profile || !event) { setSubmissionError('Event is no longer available.'); return; }
      if (profile.id !== event.organizerId) { setSubmissionError('Only the event owner can update this.'); return; }
      setIsSubmitting(true);
      setSubmissionError(null);
      const uploadedImages: Array<{ path: string; publicUrl: string }> = [];

      try {
        if (selectedImages.length > 0) {
          for (const image of selectedImages) {
            const { data, error } = await uploadEventImage(profile.id, image);
            if (error || !data) throw error ?? new Error('Image upload failed.');
            uploadedImages.push(data);
          }
        }

        const uploadedImageUrls = uploadedImages.map((image) => image.publicUrl);
        const finalImageUrls = [...existingImageUrls, ...uploadedImageUrls];
        const removedImageUrls = event.imageUrls.filter((imageUrl) => !existingImageUrls.includes(imageUrl));
        const nextCoverImageUrl = finalImageUrls[0] ?? null;

        const { error } = await updateOwnEvent(event.id, { ...values, coverImageUrl: nextCoverImageUrl });
        if (error) {
          for (const image of uploadedImages) {
            await deleteEventImage(image.path);
          }
          throw error;
        }

        const { error: replaceImagesError } = await replaceEventImages(event.id, finalImageUrls);
        if (replaceImagesError) {
          for (const image of uploadedImages) {
            await deleteEventImage(image.path);
          }
          throw replaceImagesError;
        }

        for (const removedImageUrl of removedImageUrls) {
          await deleteEventImageFromPublicUrl(removedImageUrl);
        }

        isDirtyRef.current = false;
        setShowSuccessModal(true);
      } catch (err) {
        setSubmissionError(err instanceof Error ? err.message : 'Unable to update event.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [event, navigation, profile],
  );

  const handleSuccessModalOk = useCallback(() => {
    setShowSuccessModal(false);
    navigation.goBack();
  }, [navigation]);

  // ── Guard: guest ───────────────────────────────────────────────────────
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
          <Text style={styles.stateSub}>Editing events requires a signed-in organizer account.</Text>
          <Pressable style={styles.stateBtn} onPress={() => void signOut()}>
            <Text style={styles.stateBtnText}>Return to Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Guard: loading ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.stateTitle}>Loading event…</Text>
          <Text style={styles.stateSub}>Fetching your event details and categories.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Guard: screen error ────────────────────────────────────────────────
  if (screenError) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <View style={[styles.stateIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="cloud-offline-outline" size={28} color="#EF4444" />
          </View>
          <Text style={styles.stateTitle}>Couldn't load event</Text>
          <Text style={styles.stateSub}>{screenError}</Text>
          <View style={styles.stateBtnRow}>
            <Pressable style={styles.stateBtn} onPress={() => void loadEditorData()}>
              <Text style={styles.stateBtnText}>Try Again</Text>
            </Pressable>
            <Pressable style={styles.stateSecBtn} onPress={handleBack}>
              <Text style={styles.stateSecBtnText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Guard: not found ───────────────────────────────────────────────────
  if (!event) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <View style={[styles.stateIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="search-outline" size={28} color="#EF4444" />
          </View>
          <Text style={styles.stateTitle}>Event not found</Text>
          <Text style={styles.stateSub}>This event could not be located.</Text>
          <Pressable
            style={styles.stateBtn}
            onPress={() => navigation.replace('EventDetail', { eventId: route.params.eventId })}
          >
            <Text style={styles.stateBtnText}>Back to Event</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Guard: not owner ───────────────────────────────────────────────────
  if (profile && profile.id !== event.organizerId) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <View style={[styles.stateIcon, { backgroundColor: 'rgba(251,191,36,0.1)' }]}>
            <Ionicons name="shield-outline" size={28} color="#FBBF24" />
          </View>
          <Text style={styles.stateTitle}>Not your event</Text>
          <Text style={styles.stateSub}>Only the organizer who created this event can edit it.</Text>
          <Pressable
            style={styles.stateBtn}
            onPress={() => navigation.replace('EventDetail', { eventId: event.id })}
          >
            <Text style={styles.stateBtnText}>View Event Details</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <StatusBar style="light" />
      <LinearGradient colors={['#060D1F', '#1A1005', '#060D1F']} style={StyleSheet.absoluteFill} />

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
                transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
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
            <Text style={styles.heroTitle}>Edit Event</Text>
            <Text style={styles.heroSub}>
              Update the details, schedule, or cover image for your event.
            </Text>
          </Animated.View>

          {/* ── White form sheet ── */}
          <View style={styles.formSheet}>
            <View style={styles.formHandle} />
            <EventForm
              categories={categories}
              errorMessage={submissionError}
              initialValues={initialValues!}
              isSubmitting={isSubmitting}
              onStepChange={() => {}}
              onSubmit={handleSubmit}
              onDescriptionFocus={handleDescriptionFocus}
              onDirtyChange={handleDirtyChange}
              resetKey={`${event.id}:${event.updatedAt}`}
              submitLabel={isSubmitting ? 'Saving Changes…' : 'Save Changes'}
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
            <Text style={styles.successModalTitle}>Changes saved</Text>
            <Text style={styles.successModalMessage}>Your event has been updated successfully.</Text>
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
  root:       { flex: 1, backgroundColor: '#060D1F' },
  scroll:     { flexGrow: 1, paddingBottom: 0 },
  scrollView: { flex: 1 },

  centerState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH, gap: 12,
  },
  stateIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  stateTitle:    { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#F1F5F9', textAlign: 'center' },
  stateSub:      { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 20 },
  stateBtnRow:   { flexDirection: 'row', gap: spacing.sm },
  stateBtn: {
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: radius.full,
    paddingHorizontal: 22, paddingVertical: 11, marginTop: 4,
  },
  stateBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FBBF24' },
  stateSecBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full,
    paddingHorizontal: 22, paddingVertical: 11, marginTop: 4,
  },
  stateSecBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },

  hero: {
    paddingTop: 52, paddingHorizontal: layout.screenPaddingH, paddingBottom: 24,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: {
    fontFamily: 'Inter_500Medium', fontSize: 12,
    color: '#C7DAF8', letterSpacing: 0.5, marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold', fontSize: 28,
    color: '#E2E8F0', letterSpacing: -0.5, marginBottom: 6,
  },
  heroSub: {
    fontFamily: 'Inter_400Regular', fontSize: 14,
    color: '#94A3B8', lineHeight: 21, marginBottom: 14,
  },
  editingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7,
    marginBottom: 16,
  },
  editingChipText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12,
    color: '#FBBF24', maxWidth: 220,
  },

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
