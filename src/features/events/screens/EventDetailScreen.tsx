import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PinchGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { isAdminRole } from '../../auth/contracts';
import { useEventFavorites } from '../FavoritesProvider';
import { useAppSession } from '../../../providers/AppSessionProvider';
import type { AppStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';
import { layout } from '../../../theme/layout';
import {
  cancelOwnEvent,
  deleteEventImageFromPublicUrl,
  deleteOwnEvent,
  fetchEventById,
  updateEventStatus,
} from '../api';
import {
  cancelBooking,
  fetchMyBookingForEvent,
  registerForEvent,
  updateBookingTickets,
} from '../../bookings/api';
import { formatEventDateTime, formatEventStatus, capitalizeLocation } from '../formatters';
import type { EventDetail } from '../types';
import type { BookingSummary } from '../../bookings/types';

type EventDetailScreenProps = NativeStackScreenProps<AppStackParamList, 'EventDetail'>;
type BookingActionKey = 'register' | 'update' | 'cancel';
type BookingActionModalState =
  | { phase: 'loading'; action: BookingActionKey }
  | { phase: 'result'; action: BookingActionKey; success: boolean; message: string };

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  upcoming:  { text: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
  ongoing:   { text: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  completed: { text: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  cancelled: { text: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
};

const BOOKING_ACTION_COPY: Record<BookingActionKey, {
  loadingTitle: string;
  loadingMessage: string;
  successTitle: string;
  successMessage: string;
  errorTitle: string;
  errorFallback: string;
}> = {
  register: {
    loadingTitle: 'Registering your tickets…',
    loadingMessage: 'Please wait while we reserve your slot.',
    successTitle: 'Registration successful',
    successMessage: 'You are now registered for this event.',
    errorTitle: 'Unable to register',
    errorFallback: 'Could not register for this event.',
  },
  update: {
    loadingTitle: 'Updating your booking…',
    loadingMessage: 'Applying your new ticket count.',
    successTitle: 'Booking updated',
    successMessage: 'Your ticket count has been updated.',
    errorTitle: 'Unable to update booking',
    errorFallback: 'Could not update your booking.',
  },
  cancel: {
    loadingTitle: 'Cancelling your booking…',
    loadingMessage: 'Releasing your reserved slots.',
    successTitle: 'Booking cancelled',
    successMessage: 'Your booking has been cancelled.',
    errorTitle: 'Unable to cancel booking',
    errorFallback: 'Could not cancel your booking.',
  },
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function ZoomableImage({ uri }: { uri: string }) {
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = useMemo(() => Animated.multiply(baseScale, pinchScale), [baseScale, pinchScale]);
  const lastScale = useRef(1);

  const handlePinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true },
  );

  const handlePinchStateChange = useCallback((event: { nativeEvent: { oldState: number; scale: number } }) => {
    if (event.nativeEvent.oldState === GestureState.ACTIVE) {
      lastScale.current = Math.min(Math.max(lastScale.current * event.nativeEvent.scale, 1), 4);
      baseScale.setValue(lastScale.current);
      pinchScale.setValue(1);
    }
  }, [baseScale, pinchScale]);

  return (
    <View style={styles.viewerSlide}>
      <PinchGestureHandler
        onGestureEvent={handlePinchEvent}
        onHandlerStateChange={handlePinchStateChange}
      >
        <Animated.View style={[styles.viewerImageWrap, { transform: [{ scale }] }]}>
          <Image contentFit="contain" source={{ uri }} style={styles.viewerImage} transition={150} />
        </Animated.View>
      </PinchGestureHandler>
    </View>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function EventDetailScreen({ navigation, route }: EventDetailScreenProps) {
  const { profile, signOut } = useAppSession();
  const { isFavorited, toggleFavorite } = useEventFavorites();
  const [event, setEvent]         = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [myBooking, setMyBooking] = useState<BookingSummary | null>(null);
  const [selectedTicketCount, setSelectedTicketCount] = useState(1);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [bookingErrorMessage, setBookingErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [bookingActionModal, setBookingActionModal] = useState<BookingActionModalState | null>(null);

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const viewerListRef = useRef<FlatList<string> | null>(null);

  const loadEvent = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const { data, error } = await fetchEventById(route.params.eventId);
      if (error) throw error;
      if (!data) throw new Error('Event not found or has been removed.');
      setEvent(data);
      setErrorMessage(null);
      if (showLoader) {
        Animated.spring(sheetAnim, {
          toValue: 1, useNativeDriver: true, tension: 65, friction: 10,
        }).start();
      }
    } catch (err) {
      if (showLoader) {
        setErrorMessage(getErrorMessage(err, 'Unable to load event details.'));
      }
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  }, [route.params.eventId]);

  const loadBooking = useCallback(async () => {
    if (!profile?.id) {
      setMyBooking(null);
      setSelectedTicketCount(1);
      setBookingErrorMessage(null);
      return;
    }

    setIsBookingLoading(true);
    try {
      const { data, error } = await fetchMyBookingForEvent(route.params.eventId);
      if (error) throw new Error((error as { message?: string }).message ?? 'Unable to load your booking status.');

      setMyBooking(data);
      setSelectedTicketCount(data?.ticketCount ?? 1);
      setBookingErrorMessage(null);
    } catch (err) {
      setMyBooking(null);
      setSelectedTicketCount(1);
      setBookingErrorMessage(getErrorMessage(err, 'Unable to load your booking status.'));
    } finally {
      setIsBookingLoading(false);
    }
  }, [profile?.id, route.params.eventId]);

  useFocusEffect(useCallback(() => { void Promise.all([loadEvent(), loadBooking()]); }, [loadBooking, loadEvent]));

  const isAdmin = isAdminRole(profile?.role);
  const isOwner = profile?.id === event?.organizerId;
  const canModerate = isOwner || isAdmin;
  const isSaved = event ? isFavorited(event.id) : false;
  const statusStyle = STATUS_COLORS[event?.status ?? 'upcoming'] ?? STATUS_COLORS.upcoming;
  const isAuthenticated = Boolean(profile?.id);
  const eventGallery = event?.imageUrls?.length ? event.imageUrls : (event?.coverImageUrl ? [event.coverImageUrl] : []);
  const heroPreviewPhotos = eventGallery.slice(1, 4);
  const hiddenHeroPreviewCount = Math.max(eventGallery.length - 4, 0);

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  useEffect(() => {
    if (viewerVisible) {
      setTimeout(() => {
        viewerListRef.current?.scrollToIndex({ index: viewerIndex, animated: false });
      }, 0);
    }
  }, [viewerIndex, viewerVisible]);

  const maxSelectableTickets = useMemo(() => {
    if (!event) {
      return 1;
    }

    if (myBooking) {
      return Math.max(1, myBooking.ticketCount + event.remainingSlots);
    }

    return Math.max(1, event.remainingSlots);
  }, [event, myBooking]);

  useEffect(() => {
    setSelectedTicketCount((current) => Math.min(Math.max(current, 1), maxSelectableTickets));
  }, [maxSelectableTickets]);

  const detailRows = useMemo(() =>
    event ? [
      { icon: 'location-outline'  as const, label: 'Location',    value: capitalizeLocation(event.location)              },
      { icon: 'calendar-outline'  as const, label: 'Date & Time', value: formatEventDateTime(event.startsAt)             },
      { icon: 'time-outline'      as const, label: 'Register By', value: formatEventDateTime(event.registrationDeadline) },
    ] : [], [event]);

  const handleToggleSaved = useCallback(async () => {
    if (!event) {
      return;
    }

    try {
      await toggleFavorite(event.id);
    } catch (error) {
      Alert.alert('Unable to save event', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [event, toggleFavorite]);

  const refreshAfterBookingMutation = useCallback(async () => {
    await Promise.all([loadEvent(false), loadBooking()]);
  }, [loadBooking, loadEvent]);

  const adjustTicketCount = useCallback((delta: number) => {
    setSelectedTicketCount((current) => {
      const next = current + delta;
      if (next < 1) return 1;
      if (next > maxSelectableTickets) return maxSelectableTickets;
      return next;
    });
  }, [maxSelectableTickets]);

  const showBookingActionLoading = useCallback((action: BookingActionKey) => {
    setBookingActionModal({ phase: 'loading', action });
  }, []);

  const showBookingActionResult = useCallback(
    (action: BookingActionKey, success: boolean, message?: string) => {
      const copy = BOOKING_ACTION_COPY[action];
      setBookingActionModal({
        phase: 'result',
        action,
        success,
        message: message?.trim() ? message : (success ? copy.successMessage : copy.errorFallback),
      });
    },
    [],
  );

  const handleRegisterBooking = useCallback(async () => {
    if (!event || !profile?.id) {
      Alert.alert('Sign in required', 'Please sign in to register for this event.');
      return;
    }

    setIsRegistering(true);
    showBookingActionLoading('register');
    try {
      const { error } = await registerForEvent(event.id, selectedTicketCount);
      if (error) throw error;
      await refreshAfterBookingMutation();
      showBookingActionResult('register', true);
    } catch (error) {
      showBookingActionResult(
        'register',
        false,
        getErrorMessage(error, BOOKING_ACTION_COPY.register.errorFallback),
      );
    } finally {
      setIsRegistering(false);
    }
  }, [event, profile?.id, refreshAfterBookingMutation, selectedTicketCount, showBookingActionLoading, showBookingActionResult]);

  const handleUpdateBooking = useCallback(async () => {
    if (!myBooking) {
      return;
    }

    setIsUpdatingBooking(true);
    showBookingActionLoading('update');
    try {
      const { error } = await updateBookingTickets(myBooking.id, selectedTicketCount);
      if (error) throw error;
      await refreshAfterBookingMutation();
      showBookingActionResult('update', true);
    } catch (error) {
      showBookingActionResult(
        'update',
        false,
        getErrorMessage(error, BOOKING_ACTION_COPY.update.errorFallback),
      );
    } finally {
      setIsUpdatingBooking(false);
    }
  }, [myBooking, refreshAfterBookingMutation, selectedTicketCount, showBookingActionLoading, showBookingActionResult]);

  const handleCancelBooking = useCallback(async () => {
    if (!myBooking) {
      return;
    }

    setIsCancellingBooking(true);
    showBookingActionLoading('cancel');
    try {
      const { error } = await cancelBooking(myBooking.id);
      if (error) throw error;
      await refreshAfterBookingMutation();
      showBookingActionResult('cancel', true);
    } catch (error) {
      showBookingActionResult(
        'cancel',
        false,
        getErrorMessage(error, BOOKING_ACTION_COPY.cancel.errorFallback),
      );
    } finally {
      setIsCancellingBooking(false);
    }
  }, [myBooking, refreshAfterBookingMutation, showBookingActionLoading, showBookingActionResult]);

  const confirmCancelBooking = useCallback(() => {
    Alert.alert(
      'Cancel your booking?',
      'Your reserved slots will be released to other attendees.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        { text: 'Cancel Booking', style: 'destructive', onPress: () => void handleCancelBooking() },
      ],
    );
  }, [handleCancelBooking]);

  async function handleDelete() {
    if (!event || !profile || (!isOwner && !isAdmin)) {
      Alert.alert('Not allowed', 'Only the event owner or an admin can delete this event.');
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await deleteOwnEvent(event.id);
      if (error) throw error;
      for (const imageUrl of event.imageUrls) {
        await deleteEventImageFromPublicUrl(imageUrl);
      }
      if (isOwner) {
        navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'MyEvents' } }] });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete event.');
      setIsDeleting(false);
    }
  }

  async function handleCancelEvent() {
    if (!event || !profile || !canModerate) {
      Alert.alert('Not allowed', 'Only the event owner or an admin can cancel this event.');
      return;
    }

    if (event.status === 'cancelled') {
      Alert.alert('Already cancelled', 'This event is already cancelled.');
      return;
    }

    setIsCancelling(true);
    try {
      const { error } = await updateEventStatus(event.id, 'cancelled');
      if (error) throw error;
      setEvent((current) => current ? { ...current, status: 'cancelled' } : current);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not cancel event.');
    } finally {
      setIsCancelling(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this event?',
      'This will permanently remove the event and its cover image. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void handleDelete() },
      ],
    );
  }

  async function handleCancel() {
    if (!event) return;
    const { error } = await cancelOwnEvent(event.id);
    if (error) {
      Alert.alert('Error', error.message ?? 'Could not cancel event.');
      return;
    }
    setEvent(prev => prev ? { ...prev, status: 'cancelled' } : prev);
  }

  function confirmCancel() {
    Alert.alert(
      'Cancel this event?',
      'Registered attendees will be notified. You can re-open the event later by editing it.',
      [
        { text: 'Keep Event', style: 'cancel' },
        { text: 'Cancel Event', style: 'destructive', onPress: () => void handleCancel() },
      ],
    );
  }

  const isBookingMutationLoading = isRegistering || isUpdatingBooking || isCancellingBooking;
  const isTicketStepperDisabled = isBookingLoading || isBookingMutationLoading;
  const canDecreaseTickets = selectedTicketCount > 1;
  const canIncreaseTickets = selectedTicketCount < maxSelectableTickets;
  const registrationDeadlineTimestamp = Date.parse(event?.registrationDeadline ?? '');
  const eventStartTimestamp = Date.parse(event?.startsAt ?? '');
  const hasRegistrationEnded =
    event?.status !== 'upcoming'
    || (Number.isFinite(registrationDeadlineTimestamp) && Date.now() > registrationDeadlineTimestamp)
    || (Number.isFinite(eventStartTimestamp) && Date.now() >= eventStartTimestamp);
  const isRegisterDisabled =
    isTicketStepperDisabled
    || hasRegistrationEnded
    || (event?.remainingSlots ?? 0) <= 0;
  const isUpdateDisabled =
    isTicketStepperDisabled
    || !myBooking
    || selectedTicketCount === myBooking.ticketCount;
  const isCancelBookingDisabled = isTicketStepperDisabled || !myBooking;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D', '#1E3A8A']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <Ionicons name="hourglass-outline" size={28} color="#93C5FD" />
          </View>
          <Text style={styles.stateTitle}>Loading event…</Text>
          <Text style={styles.stateSub}>Fetching the latest details.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (errorMessage || !event) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#060D1F', '#0F1E3D', '#1E3A8A']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <View style={[styles.stateIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Ionicons name="cloud-offline-outline" size={28} color="#EF4444" />
          </View>
          <Text style={styles.stateTitle}>Event unavailable</Text>
          <Text style={styles.stateSub}>{errorMessage ?? 'This event could not be found.'}</Text>
          <Pressable style={styles.backBtnState} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnStateText}>← Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main content ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <StatusBar style="light" />
      <LinearGradient colors={['#060D1F', '#0F1E3D', '#1E3A8A']} style={StyleSheet.absoluteFill} />

      <Modal
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
        transparent
        visible={viewerVisible}
      >
        <View style={styles.viewerModal}>
          <View style={styles.viewerTopBar}>
            <Text style={styles.viewerCounter}>
              {viewerIndex + 1} / {eventGallery.length}
            </Text>
            <Pressable style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          <FlatList
            ref={viewerListRef}
            data={eventGallery}
            getItemLayout={(_, index) => ({
              index,
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
            })}
            horizontal
            initialNumToRender={1}
            keyExtractor={(item, index) => `${item}-${index}`}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setViewerIndex(nextIndex);
            }}
            pagingEnabled
            renderItem={({ item }) => <ZoomableImage uri={item} />}
            showsHorizontalScrollIndicator={false}
          />
          <Text style={styles.viewerHint}>Pinch to zoom. Swipe left or right for more photos.</Text>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (bookingActionModal?.phase === 'result') {
            setBookingActionModal(null);
          }
        }}
        transparent
        visible={Boolean(bookingActionModal)}
      >
        <View style={styles.bookingModalBackdrop}>
          <View style={styles.bookingModalCard}>
            {bookingActionModal?.phase === 'loading' ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.bookingModalTitle}>{BOOKING_ACTION_COPY[bookingActionModal.action].loadingTitle}</Text>
                <Text style={styles.bookingModalMessage}>{BOOKING_ACTION_COPY[bookingActionModal.action].loadingMessage}</Text>
              </>
            ) : bookingActionModal?.phase === 'result' ? (
              <>
                <View
                  style={[
                    styles.bookingModalIconWrap,
                    bookingActionModal.success ? styles.bookingModalIconSuccess : styles.bookingModalIconError,
                  ]}
                >
                  <Ionicons
                    name={bookingActionModal.success ? 'checkmark' : 'close'}
                    size={22}
                    color={bookingActionModal.success ? '#16A34A' : '#DC2626'}
                  />
                </View>
                <Text style={styles.bookingModalTitle}>
                  {bookingActionModal.success
                    ? BOOKING_ACTION_COPY[bookingActionModal.action].successTitle
                    : BOOKING_ACTION_COPY[bookingActionModal.action].errorTitle}
                </Text>
                <Text style={styles.bookingModalMessage}>{bookingActionModal.message}</Text>
                <Pressable
                  style={({ pressed }) => [styles.bookingModalOkBtn, pressed && { opacity: 0.88 }]}
                  onPress={() => setBookingActionModal(null)}
                >
                  <Text style={styles.bookingModalOkBtnText}>OK</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Hero ── */}
        <View style={styles.heroWrap}>
          {eventGallery.length > 0 ? (
            <Pressable onPress={() => openViewer(0)} style={styles.heroImagePressable}>
              <Image
                contentFit="cover"
                source={{ uri: eventGallery[0] }}
                style={styles.heroImage}
                transition={200}
              />
            </Pressable>
          ) : (
            <LinearGradient
              colors={['#060D1F', '#0F2167', '#1E3A8A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroImage}
            >
              <View style={styles.heroPlaceholderIcon}>
                <Ionicons name="calendar" size={52} color="rgba(255,255,255,0.2)" />
              </View>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.15)']}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="box-none" style={styles.overlayTop}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.overlayBtn, pressed && styles.overlayBtnPressed]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.overlayBtn, pressed && styles.overlayBtnPressed]}
              onPress={() => void handleToggleSaved()}
            >
                <Ionicons
                  name={isSaved ? 'heart' : 'heart-outline'}
                size={22}
                color={isSaved ? '#FF3CAC' : '#fff'}
              />
            </Pressable>
          </View>
          {heroPreviewPhotos.length > 0 ? (
            <View pointerEvents="box-none" style={styles.heroPreviewStrip}>
              {heroPreviewPhotos.map((imageUrl, index) => (
                <Pressable
                  key={`${event.id}-hero-preview-${index + 1}`}
                  onPress={() => openViewer(index + 1)}
                  style={styles.heroPreviewCard}
                >
                  <Image
                    contentFit="cover"
                    source={{ uri: imageUrl }}
                    style={styles.heroPreviewImage}
                    transition={120}
                  />
                </Pressable>
              ))}
              {hiddenHeroPreviewCount > 0 ? (
                <Pressable
                  onPress={() => openViewer(4)}
                  style={[styles.heroPreviewCard, styles.heroPreviewMoreCard]}
                >
                  <Text style={styles.heroPreviewMoreText}>+{hiddenHeroPreviewCount}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* ── Sheet ── */}
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: sheetAnim,
              transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          <View style={styles.grabber} />

          {/* Status + category + title */}
          <View style={styles.titleBlock}>
            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusStyle.text }]} />
                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                  {formatEventStatus(event.status)}
                </Text>
              </View>
              {event.isFlagged && (
                <View style={styles.flaggedBadge}>
                  <Ionicons name="flag" size={11} color="#EF4444" />
                  <Text style={styles.flaggedText}>Flagged</Text>
                </View>
              )}
              {event.categoryName ? (
                <View style={styles.categoryPill}>
                  <Ionicons name="pricetag-outline" size={10} color={colors.primary} />
                  <Text style={styles.categoryText}>{event.categoryName}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
          </View>

          {/* Actions */}
          <View style={styles.metaRow}>
            <View style={styles.actionRow} />
          </View>

          {/* Detail rows */}
          <Text style={styles.sectionTitle}>Event Details</Text>
          <View style={styles.detailCard}>
            {detailRows.map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name={row.icon} size={17} color={colors.primary} />
                </View>
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Spots available */}
          <View style={styles.spotsSection}>
            <View style={styles.spotsHeader}>
              <Text style={styles.spotsLabel}>Spots available</Text>
              <Text style={styles.spotsCount}>{event.remainingSlots} / {event.capacity} remaining</Text>
            </View>
            <View style={styles.spotsTrack}>
              <View style={[styles.spotsFill, { width: `${event.capacity > 0 ? (event.remainingSlots / event.capacity) * 100 : 0}%` }]} />
            </View>
          </View>

          {/* Organizer */}
          <Text style={styles.sectionTitle}>Event Organizer</Text>
          <View style={styles.organizerCard}>
            <View style={styles.organizerAvatar}>
              {event.organizerAvatarUrl ? (
                <Image
                  contentFit="cover"
                  source={{ uri: event.organizerAvatarUrl }}
                  style={styles.organizerAvatarImage}
                  transition={150}
                />
              ) : (
                <Ionicons name="person" size={22} color={colors.primary} />
              )}
            </View>
            <View style={styles.organizerInfo}>
              <Text style={styles.organizerName}>
                {event.organizerName ?? (isOwner ? 'You' : 'Eventure Organizer')}
              </Text>
              <Text style={styles.organizerRole}>
                {isOwner ? '✦ You created this event' : 'Hosted by an Eventure organizer'}
              </Text>
            </View>
            {isOwner && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>Owner</Text>
              </View>
            )}
          </View>

          {/* Missing cover image notice (owner only) */}
          {isOwner && !event.coverImageUrl && (
            <View style={styles.noticeCard}>
              <View style={styles.noticeIcon}>
                <Ionicons name="image-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Add a cover image</Text>
                <Text style={styles.noticeSub}>Your event is live but missing a visual — add one to stand out in the feed.</Text>
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>About this event</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>

          {/* Tags */}
          {event.tags.length > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsRow}>
                {event.tags.map(tag => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Delete — owner only */}
          {isOwner && (
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.88 }]}
              onPress={confirmDelete}
            >
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
              <Text style={styles.deleteBtnText}>Delete Event</Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={styles.stickyFooter}>
        {isOwner ? (
          <View style={styles.ownerFooterRow}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.88 }, event.status === 'cancelled' && styles.cancelBtnDisabled]}
              onPress={confirmCancel}
              disabled={event.status === 'cancelled'}
            >
              <Ionicons name="close-circle-outline" size={19} color={event.status === 'cancelled' ? '#9CA3AF' : '#EF4444'} />
              <Text style={[styles.cancelBtnText, event.status === 'cancelled' && styles.cancelBtnTextDisabled]}>
                {event.status === 'cancelled' ? 'Cancelled' : 'Cancel Event'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.88 }]}
              onPress={() => navigation.navigate('EditEvent', { eventId: event.id })}
            >
              <Ionicons name="pencil" size={19} color="#fff" />
              <Text style={styles.editBtnText}>Edit Event</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bookingFooterContent}>
            {isAuthenticated ? (
              <>
                <View style={styles.ticketStepperRow}>
                  <Text style={styles.ticketStepperLabel}>
                    {myBooking ? 'Update tickets' : 'Select tickets'}
                  </Text>
                  <View style={styles.ticketStepper}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.ticketStepperBtn,
                        (pressed || (!canDecreaseTickets || isTicketStepperDisabled)) && styles.ticketStepperBtnPressed,
                      ]}
                      onPress={() => adjustTicketCount(-1)}
                      disabled={!canDecreaseTickets || isTicketStepperDisabled}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={!canDecreaseTickets || isTicketStepperDisabled ? '#9CA3AF' : '#111827'}
                      />
                    </Pressable>
                    <Text style={styles.ticketStepperCount}>{selectedTicketCount}</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.ticketStepperBtn,
                        (pressed || (!canIncreaseTickets || isTicketStepperDisabled)) && styles.ticketStepperBtnPressed,
                      ]}
                      onPress={() => adjustTicketCount(1)}
                      disabled={!canIncreaseTickets || isTicketStepperDisabled}
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={!canIncreaseTickets || isTicketStepperDisabled ? '#9CA3AF' : '#111827'}
                      />
                    </Pressable>
                  </View>
                </View>

                {myBooking ? (
                  <>
                    <Text style={styles.bookingHintText}>
                      You currently have {myBooking.ticketCount} ticket{myBooking.ticketCount === 1 ? '' : 's'} booked.
                    </Text>
                    <View style={styles.bookingActionRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.bookBtn,
                          styles.bookingPrimaryBtn,
                          pressed && { opacity: 0.88 },
                          isUpdateDisabled && styles.bookBtnDisabled,
                        ]}
                        onPress={() => void handleUpdateBooking()}
                        disabled={isUpdateDisabled}
                      >
                        <Ionicons name="refresh-outline" size={18} color="#fff" />
                        <Text style={styles.bookBtnText}>{isUpdatingBooking ? 'Updating…' : 'Update'}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.cancelBtn,
                          styles.bookingCancelBtn,
                          pressed && { opacity: 0.88 },
                          isCancelBookingDisabled && styles.cancelBtnDisabled,
                        ]}
                        onPress={confirmCancelBooking}
                        disabled={isCancelBookingDisabled}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color={isCancelBookingDisabled ? '#9CA3AF' : '#EF4444'}
                        />
                        <Text style={[styles.cancelBtnText, isCancelBookingDisabled && styles.cancelBtnTextDisabled]}>
                          {isCancellingBooking ? 'Cancelling…' : 'Cancel Booking'}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.bookBtn,
                      pressed && { opacity: 0.88 },
                      isRegisterDisabled && styles.bookBtnDisabled,
                    ]}
                    onPress={() => void handleRegisterBooking()}
                    disabled={isRegisterDisabled}
                  >
                    <Ionicons name="ticket-outline" size={20} color="#fff" />
                    <Text style={styles.bookBtnText}>
                      {isBookingLoading
                        ? 'Checking booking…'
                        : isRegistering
                          ? 'Registering…'
                          : hasRegistrationEnded
                            ? 'Registration Ended'
                          : event.remainingSlots <= 0
                            ? 'Sold Out'
                            : 'Register Now'}
                    </Text>
                  </Pressable>
                )}

                {bookingErrorMessage ? <Text style={styles.bookingErrorText}>{bookingErrorMessage}</Text> : null}
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.bookBtn, pressed && { opacity: 0.88 }]}
                onPress={() => void signOut()}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#fff" />
                <Text style={styles.bookBtnText}>Sign in to register</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D1F' },
  scroll: { flexGrow: 1 },

  centerState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH, gap: 12,
  },
  stateIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  stateTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#F1F5F9' },
  stateSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#475569', textAlign: 'center' },
  backBtnState: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  backBtnStateText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#CBD5E1' },

  viewerModal: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.96)',
    justifyContent: 'center',
  },
  viewerTopBar: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewerCounter: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#E2E8F0' },
  viewerCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15,23,42,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  viewerImageWrap: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '100%' },
  viewerHint: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#CBD5E1',
  },
  bookingModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bookingModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 10,
  },
  bookingModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingModalIconSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  bookingModalIconError: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  bookingModalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
  },
  bookingModalMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },
  bookingModalOkBtn: {
    marginTop: 6,
    minWidth: 110,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingModalOkBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },

  heroWrap: { height: 340, position: 'relative' },
  heroImagePressable: { width: '100%', height: '100%' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholderIcon: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  overlayTop: {
    position: 'absolute', top: 52, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
  },
  heroPreviewStrip: {
    position: 'absolute',
    left: layout.screenPaddingH,
    bottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroPreviewCard: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  heroPreviewImage: { width: '100%', height: '100%' },
  heroPreviewMoreCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
  },
  heroPreviewMoreText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  overlayBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  overlayBtnPressed: { opacity: 0.7 },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 20,
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 2,
  },

  titleBlock: { gap: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  flaggedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  flaggedText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#EF4444' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#0F172A', lineHeight: 34, letterSpacing: -0.4 },

  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end',
  },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(30,58,138,0.07)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  categoryText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  actionRow: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: '#F1F5F9' },

  detailCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 18,
    borderWidth: 1, borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  detailIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(30,58,138,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  detailText: { flex: 1, gap: 3 },
  detailLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.7 },
  detailValue: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#111827' },

  organizerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FAFAFA',
    borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9',
    padding: 16,
  },
  organizerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(30,58,138,0.08)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  organizerAvatarImage: { width: '100%', height: '100%' },
  organizerInfo: { flex: 1, gap: 3 },
  organizerName: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#111827' },
  organizerRole: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280' },
  ownerBadge: {
    backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1, borderColor: '#A7F3D0',
  },
  ownerBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#059669' },

  spotsSection: { gap: 8 },
  spotsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spotsLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6B7280' },
  spotsCount: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#111827' },
  spotsTrack: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  spotsFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },

  noticeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A',
    padding: 16,
  },
  noticeIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  noticeTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#92400E' },
  noticeSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#B45309', lineHeight: 20, marginTop: 3 },

  descSection: { gap: 10 },
  tagsSection: { gap: 10 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111827' },
  description: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#374151', lineHeight: 25 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    backgroundColor: '#F3F4F6', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 7,
  },
  tagText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#4B5563' },

  stickyFooter: {
    backgroundColor: '#fff',
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bookBtn: {
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 56, gap: 10,
  },
  bookBtnDisabled: { opacity: 0.55 },
  bookBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  bookingFooterContent: { gap: 10 },
  ticketStepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  ticketStepperLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111827' },
  ticketStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 4,
    height: 38,
  },
  ticketStepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketStepperBtnPressed: { backgroundColor: '#E5E7EB' },
  ticketStepperCount: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#111827',
  },
  bookingHintText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280' },
  bookingActionRow: { flexDirection: 'row', gap: 10 },
  bookingPrimaryBtn: { flex: 1 },
  bookingCancelBtn: { flex: 1, minHeight: 56 },
  bookingErrorText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#DC2626' },
  ownerFooterRow: { flexDirection: 'row', gap: 12 },
  editBtn: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 56, gap: 10,
  },
  editBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  deleteBtn: {
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 56, gap: 10,
  },
  deleteBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#EF4444' },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 56, gap: 10,
  },
  cancelBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  cancelBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#EF4444' },
  cancelBtnTextDisabled: { color: '#9CA3AF' },
});
