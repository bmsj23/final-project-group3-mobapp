import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerNative, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import DateTimePicker from 'react-native-ui-datepicker';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../../theme/colors';
import { radius } from '../../../theme/radius';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { EVENT_IMAGE_MAX_SIZE_LABEL } from '../contracts';
import {
  formatDateTimeInput,
  parseDateTimeInput,
  tagsFromInput,
  tagsToInput,
} from '../formatters';
import { pickEventImageAsset } from '../imagePicker';
import type {
  EventCategorySummary,
  EventFormErrors,
  EventFormValues,
  EventImageAsset,
} from '../types';
import {
  validateEventForm,
  isFutureIsoDate,
  isRegistrationDeadlineBeforeEvent,
} from '../validation';

// ─── Public types ─────────────────────────────────────────────────────────────
export type EventFormSubmission = {
  values: EventFormValues;
  selectedImages: EventImageAsset[];
  existingImageUrls: string[];
  originalCoverImageUrl: string | null;
  coverImageChanged: boolean;
  existingImageRemoved: boolean; // true only when user explicitly removed the original
};

type EventFormProps = {
  resetKey: string;
  initialValues: EventFormValues;
  categories: EventCategorySummary[];
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (submission: EventFormSubmission) => Promise<void>;
  onStepChange?: (step: number) => void;
  onDescriptionFocus?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Details', icon: 'document-text-outline' as const },
  { label: 'Schedule', icon: 'calendar-outline' as const },
  { label: 'Review', icon: 'cloud-upload-outline' as const },
];

// ─── Small helper: styled label ──────────────────────────────────────────────
function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <View style={fl.row}>
      <Text style={fl.label}>{text}</Text>
      {required && <Text style={fl.required}> *</Text>}
    </View>
  );
}
const fl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#334155' },
  required: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#EF4444' },
});

// ─── Custom text field ────────────────────────────────────────────────────────
function Field({
  label,
  required,
  error,
  hint,
  icon,
  multiline,
  ...inputProps
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  const hasError = Boolean(error);
  return (
    <View style={fieldStyles.wrap}>
      <FieldLabel text={label} required={required} />
      <View style={[
        fieldStyles.shell,
        hasError && fieldStyles.shellError,
        multiline && fieldStyles.shellMulti,
      ]}>
        {icon && (
          <View style={[fieldStyles.iconWrap, hasError && fieldStyles.iconWrapError]}>
            <Ionicons name={icon} size={16} color={hasError ? colors.error : colors.primary} />
          </View>
        )}
        <TextInput
          style={[
            fieldStyles.input,
            icon && fieldStyles.inputWithIcon,
            multiline && fieldStyles.inputMulti,
          ]}
          placeholderTextColor="#B0BFCD"
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : undefined}
          {...inputProps}
        />
      </View>
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}
const fieldStyles = StyleSheet.create({
  wrap: { gap: 0 },
  shell: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: radius.md, minHeight: 54,
    overflow: 'hidden',
  },
  shellError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  shellMulti: { alignItems: 'flex-start', minHeight: 110 },
  iconWrap: {
    width: 48, alignItems: 'center', justifyContent: 'center' as any,
    borderRightWidth: 1, borderRightColor: '#E2E8F0',
    alignSelf: 'stretch',
  },
  iconWrapError: { borderRightColor: '#FECACA', backgroundColor: '#FFF0F0' },
  input: {
    flex: 1, fontFamily: 'Inter_400Regular',
    fontSize: 15, color: '#0F172A',
    paddingHorizontal: spacing.md, minHeight: 52,
  },
  inputWithIcon: { paddingLeft: spacing.sm },
  inputMulti: { paddingTop: spacing.md, minHeight: 108 },
  error: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.error, marginTop: 5 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8', marginTop: 5 },
});

// ─── Review row ───────────────────────────────────────────────────────────────
function ReviewRow({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={rrStyles.row}>
      <View style={[rrStyles.iconWrap, color ? { backgroundColor: color + '18' } : null]}>
        <Ionicons name={icon} size={15} color={color ?? colors.primary} />
      </View>
      <View style={rrStyles.text}>
        <Text style={rrStyles.label}>{label}</Text>
        <Text style={rrStyles.value} numberOfLines={2}>{value || '—'}</Text>
      </View>
    </View>
  );
}
const rrStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0F172A', lineHeight: 20 },
});

// ─── Step nav buttons ─────────────────────────────────────────────────────────
function NavRow({
  onBack,
  onNext,
  nextLabel,
  backDisabled,
  nextDisabled,
  nextColor,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  nextColor?: string[];
}) {
  return (
    <View style={navStyles.row}>
      <Pressable
        disabled={backDisabled}
        style={({ pressed }) => [navStyles.backBtn, backDisabled && navStyles.backBtnDisabled, pressed && { opacity: 0.7 }]}
        onPress={onBack}
      >
        <Ionicons name="chevron-back" size={18} color={backDisabled ? '#CBD5E1' : '#64748B'} />
        <Text style={[navStyles.backText, backDisabled && { color: '#CBD5E1' }]}>Back</Text>
      </Pressable>
      <Pressable
        disabled={nextDisabled}
        style={({ pressed }) => [navStyles.nextBtn, nextDisabled && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
        onPress={onNext}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark] as [string, string]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={navStyles.nextGrad}
        >
          <Text style={navStyles.nextText}>{nextLabel}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
const navStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: radius.md, minHeight: 52, paddingHorizontal: spacing.lg, flex: 1,
    justifyContent: 'center',
  },
  backBtnDisabled: { borderColor: '#F1F5F9' },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },
  nextBtn: { flex: 2, borderRadius: radius.md, overflow: 'hidden' },
  nextGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 52, gap: 6, paddingHorizontal: spacing.lg,
  },
  nextText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
});

// ─── Step 0 validation ────────────────────────────────────────────────────────
function validateStep0(
  values: EventFormValues,
  capacityInput: string,
): EventFormErrors {
  const errs: EventFormErrors = {};
  if (!values.title.trim()) errs.title = 'Event name is required.';
  if (!values.category) errs.category = 'Please select a category.';
  if (!values.location.trim()) errs.location = 'Location is required.';
  if (!values.description.trim()) errs.description = 'Description is required.';
  const cap = Number.parseInt(capacityInput.trim(), 10);
  if (!capacityInput.trim() || !Number.isFinite(cap) || cap <= 0)
    errs.capacity = 'Capacity must be greater than zero.';
  return errs;
}

// ─── Step 1 validation ────────────────────────────────────────────────────────
function validateStep1(
  dateTimeInput: string,
  deadlineInput: string,
): EventFormErrors {
  const errs: EventFormErrors = {};
  const dt = parseDateTimeInput(dateTimeInput);
  const ddl = parseDateTimeInput(deadlineInput);
  if (!dt || !isFutureIsoDate(dt)) errs.dateTime = 'Event date must be a valid future date.';
  if (!ddl || !isFutureIsoDate(ddl)) errs.registrationDeadline = 'Deadline must be a valid future date.';
  else if (dt && !isRegistrationDeadlineBeforeEvent(ddl, dt))
    errs.registrationDeadline = 'Deadline must be earlier than the event date and time.';
  return errs;
}

type PickerTarget = 'eventDate' | 'eventTime' | 'deadlineDate' | 'deadlineTime';

function getDateFromInput(value: string) {
  const isoValue = parseDateTimeInput(value);
  if (!isoValue) return null;
  const date = new Date(isoValue);
  return Number.isFinite(date.getTime()) ? date : null;
}

function createDefaultPickerDate() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return now;
}

function getTodayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function setDatePart(currentValue: string, nextDate: Date) {
  const base = getDateFromInput(currentValue) ?? createDefaultPickerDate();
  base.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  return formatDateTimeInput(base.toISOString());
}

function setTimePart(currentValue: string, nextTime: Date) {
  const base = getDateFromInput(currentValue) ?? createDefaultPickerDate();
  base.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);
  return formatDateTimeInput(base.toISOString());
}

function formatPickerDate(value: string) {
  const date = getDateFromInput(value);
  if (!date) return 'Select date';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPickerTime(value: string) {
  const date = getDateFromInput(value);
  if (!date) return 'Select time';
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function getPickerTitle(target: PickerTarget | null) {
  if (target === 'eventDate') return 'Select event date';
  if (target === 'eventTime') return 'Select event time';
  if (target === 'deadlineDate') return 'Select registration date';
  if (target === 'deadlineTime') return 'Select registration time';
  return '';
}

function PickerField({
  label,
  required,
  value,
  icon,
  error,
  onPress,
}: {
  label: string;
  required?: boolean;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  onPress: () => void;
}) {
  const hasError = Boolean(error);
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel text={label} required={required} />
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.pickerField,
          hasError && styles.pickerFieldError,
          pressed && { opacity: 0.88 },
        ]}
      >
        <View style={[styles.pickerFieldIconWrap, hasError && styles.pickerFieldIconWrapError]}>
          <Ionicons color={hasError ? colors.error : colors.primary} name={icon} size={16} />
        </View>
        <Text style={[styles.pickerFieldValue, !value.startsWith('Select') && styles.pickerFieldValueFilled]}>
          {value}
        </Text>
        <Ionicons color="#94A3B8" name="chevron-down" size={16} />
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EventForm({
  resetKey,
  initialValues,
  categories,
  submitLabel,
  isSubmitting,
  errorMessage,
  onSubmit,
  onStepChange,
  onDescriptionFocus,
  onDirtyChange,
}: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [capacityInput, setCapacityInput] = useState(initialValues.capacity > 0 ? String(initialValues.capacity) : '');
  const [dateTimeInput, setDateTimeInput] = useState(formatDateTimeInput(initialValues.dateTime));
  const [deadlineInput, setDeadlineInput] = useState(formatDateTimeInput(initialValues.registrationDeadline));
  const [tagsInput, setTagsInput] = useState(tagsToInput(initialValues.tags));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [selectedImages, setSelectedImages] = useState<EventImageAsset[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [existingSelected, setExistingSelected] = useState(true);
  const [existingImageIndex, setExistingImageIndex] = useState(0);
  const initialExistingImageUrls = initialValues.imageUrls?.length
    ? initialValues.imageUrls
    : (initialValues.coverImageUrl ? [initialValues.coverImageUrl] : []);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(initialExistingImageUrls);
  const [step, setStep] = useState(0);
  const [activePicker, setActivePicker] = useState<PickerTarget | null>(null);
  const galleryScrollRef = useRef<ScrollView | null>(null);

  // Slide animation between steps
  const slideAnim = useRef(new Animated.Value(0)).current;

  function animateStep(nextStep: number) {
    const dir = nextStep > step ? 30 : -30;
    slideAnim.setValue(dir);
    setStep(nextStep);
    onStepChange?.(nextStep);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }

  useEffect(() => {
    setValues(initialValues);
    setCapacityInput(initialValues.capacity > 0 ? String(initialValues.capacity) : '');
    setDateTimeInput(formatDateTimeInput(initialValues.dateTime));
    setDeadlineInput(formatDateTimeInput(initialValues.registrationDeadline));
    setTagsInput(tagsToInput(initialValues.tags));
    setErrors({});
    setSelectedImages([]);
    setSelectedImageIndex(0);
    setExistingImageUrls(initialValues.imageUrls?.length ? initialValues.imageUrls : (initialValues.coverImageUrl ? [initialValues.coverImageUrl] : []));
    setExistingImageIndex(0);
    setExistingSelected(true);
    setStep(0);
    setActivePicker(null);
    onStepChange?.(0);
  }, [resetKey]);

  useEffect(() => {
    const initialCapacityInput = initialValues.capacity > 0 ? String(initialValues.capacity) : '';
    const initialDateTimeInput = formatDateTimeInput(initialValues.dateTime);
    const initialDeadlineInput = formatDateTimeInput(initialValues.registrationDeadline);
    const initialTagsInput = tagsToInput(initialValues.tags);
    const initialImageUrls = initialValues.imageUrls?.length
      ? initialValues.imageUrls
      : (initialValues.coverImageUrl ? [initialValues.coverImageUrl] : []);

    const isDirty =
      values.title !== initialValues.title ||
      values.description !== initialValues.description ||
      values.location !== initialValues.location ||
      values.category !== initialValues.category ||
      capacityInput !== initialCapacityInput ||
      dateTimeInput !== initialDateTimeInput ||
      deadlineInput !== initialDeadlineInput ||
      tagsInput !== initialTagsInput ||
      initialImageUrls.join('|') !== existingImageUrls.join('|') ||
      selectedImages.length > 0 ||
      step > 0;

    onDirtyChange?.(isDirty);
  }, [
    capacityInput,
    dateTimeInput,
    deadlineInput,
    existingImageUrls,
    initialValues,
    onDirtyChange,
    selectedImages,
    step,
    tagsInput,
    values,
  ]);

  // ── Derived preview URI ─────────────────────────────────────────────────
  // Show the existing cover when it's selected and not removed,
  // otherwise show whichever new image is active.
  const existingCoverUri = existingImageUrls[existingImageIndex] ?? null;
  const previewUri =
    existingSelected && existingCoverUri
      ? existingCoverUri
      : selectedImages.length > 0
        ? selectedImages[selectedImageIndex]?.uri ?? existingCoverUri
        : existingCoverUri;

  // ── Helpers ─────────────────────────────────────────────────────────────
  function updateValue<K extends keyof EventFormValues>(key: K, val: EventFormValues[K]) {
    setValues(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: undefined }));
  }

  // ── FIX: allowsMultipleSelection is set in imagePicker.ts; here we
  //    merge the returned array into state inside the updater so we never
  //    read stale selectedImages.length from the closure.
  async function handlePickImage() {
    setErrors(p => ({ ...p, coverImageUrl: undefined }));
    const { data, error } = await pickEventImageAsset();
    if (error) { setErrors(p => ({ ...p, coverImageUrl: error.message })); return; }
    if (!data) return;

    const incoming = Array.isArray(data) ? data : [data];

    setSelectedImages(prev => {
      const updated = [...prev, ...incoming];
      // Set index to the last newly added image — safe because we're inside the updater
      setSelectedImageIndex(updated.length - 1);
      return updated;
    });
    setExistingSelected(false);
  }

  function handleRemoveExistingImage(index: number) {
    setExistingImageUrls((prev) => {
      const next = prev.filter((_, currentIndex) => currentIndex !== index);
      setExistingImageIndex((current) => Math.min(current, Math.max(0, next.length - 1)));

      if (existingSelected && index === existingImageIndex) {
        setExistingSelected(next.length > 0);
        if (next.length === 0 && selectedImages.length > 0) {
          setExistingSelected(false);
        }
      }

      return next;
    });
  }

  function handleRemoveImage(index: number) {
    if (selectedImages.length > 0) {
      const newImages = selectedImages.filter((_, i) => i !== index);
      setSelectedImages(newImages);
      setSelectedImageIndex(Math.min(selectedImageIndex, Math.max(0, newImages.length - 1)));
      // If no new images remain, fall back to showing the existing cover
      if (newImages.length === 0) setExistingSelected(true);
    }
  }

  function handleClearAll() {
    setExistingImageUrls([]);
    setSelectedImages([]);
    setSelectedImageIndex(0);
    setExistingImageIndex(0);
    setExistingSelected(true);
  }

  function scrollGalleryLeft() {
    const itemWidth = 60 + spacing.sm;
    galleryScrollRef.current?.scrollTo({
      x: Math.max(0, selectedImageIndex * itemWidth - itemWidth),
      animated: true,
    });
    setSelectedImageIndex(Math.max(0, selectedImageIndex - 1));
  }

  function scrollGalleryRight() {
    const itemWidth = 60 + spacing.sm;
    if (selectedImageIndex < selectedImages.length - 1) {
      galleryScrollRef.current?.scrollTo({
        x: (selectedImageIndex + 1) * itemWidth,
        animated: true,
      });
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  }

  function getPickerValue(target: PickerTarget) {
    switch (target) {
      case 'eventDate':
      case 'eventTime':
        return getDateFromInput(dateTimeInput) ?? createDefaultPickerDate();
      case 'deadlineDate':
      case 'deadlineTime':
        return getDateFromInput(deadlineInput) ?? getDateFromInput(dateTimeInput) ?? createDefaultPickerDate();
    }
  }

  function handlePickerChange(target: PickerTarget, event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type !== 'set' || !selectedDate) return;

    if (target === 'eventDate') {
      setDateTimeInput(setDatePart(dateTimeInput, selectedDate));
      setErrors(prev => ({ ...prev, dateTime: undefined }));
      return;
    }
    if (target === 'eventTime') {
      setDateTimeInput(setTimePart(dateTimeInput, selectedDate));
      setErrors(prev => ({ ...prev, dateTime: undefined }));
      return;
    }
    if (target === 'deadlineDate') {
      setDeadlineInput(setDatePart(deadlineInput, selectedDate));
      setErrors(prev => ({ ...prev, registrationDeadline: undefined }));
      return;
    }
    setDeadlineInput(setTimePart(deadlineInput, selectedDate));
    setErrors(prev => ({ ...prev, registrationDeadline: undefined }));
  }

  // ── Step nav with validation ────────────────────────────────────────────
  function goToStep1() {
    const errs = validateStep0(values, capacityInput);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    animateStep(1);
  }

  function goToStep2() {
    const errs = validateStep1(dateTimeInput, deadlineInput);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    animateStep(2);
  }

  async function handleSubmit() {
    const parsedCap = Number.parseInt(capacityInput.trim(), 10);
    const nextValues: EventFormValues = {
      ...values,
      capacity: Number.isFinite(parsedCap) ? parsedCap : 0,
      coverImageUrl: existingImageUrls[0] ?? null,
      imageUrls: existingImageUrls,
      dateTime: parseDateTimeInput(dateTimeInput),
      registrationDeadline: parseDateTimeInput(deadlineInput),
      tags: tagsFromInput(tagsInput),
    };
    const allErrors = validateEventForm(nextValues);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const step0Fields: (keyof EventFormValues)[] = ['title', 'category', 'location', 'capacity', 'description'];
      const step1Fields: (keyof EventFormValues)[] = ['dateTime', 'registrationDeadline'];
      if (step0Fields.some(f => allErrors[f])) { animateStep(0); return; }
      if (step1Fields.some(f => allErrors[f])) { animateStep(1); return; }
      return;
    }
    await onSubmit({
      values: nextValues,
      selectedImages,
      existingImageUrls,
      originalCoverImageUrl: initialValues.coverImageUrl ?? null,
      coverImageChanged: selectedImages.length > 0 || initialExistingImageUrls.join('|') !== existingImageUrls.join('|'),
      existingImageRemoved: initialExistingImageUrls.length > 0 && existingImageUrls.length === 0,
    });
  }

  return (
    <View style={styles.root}>
      <Modal
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
        transparent
        visible={Boolean(activePicker)}
      >
        <Pressable style={styles.pickerModalBackdrop} onPress={() => setActivePicker(null)}>
          <Pressable onPress={() => {}} style={styles.pickerModalCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerHeaderText}>{getPickerTitle(activePicker)}</Text>
              <Pressable onPress={() => setActivePicker(null)} style={styles.pickerDoneBtn}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>

            {activePicker ? (
              <View style={styles.pickerContainer}>
                {activePicker.endsWith('Date') ? (
                  <DateTimePicker
                    mode="single"
                    date={getPickerValue(activePicker)}
                    minDate={getTodayAtMidnight()}
                    disabledDates={
                      activePicker === 'deadlineDate'
                        ? (date) => {
                            const eventDate = getDateFromInput(dateTimeInput);
                            if (!eventDate || !date) return false;
                            const d = dayjs(date).toDate();
                            d.setHours(0, 0, 0, 0);
                            const event = new Date(eventDate);
                            event.setHours(0, 0, 0, 0);
                            return d > event;
                          }
                        : undefined
                    }
                    onChange={({ date }) => {
                      if (!date) return;
                      const selected = dayjs(date).toDate();
                      if (activePicker === 'eventDate') {
                        setDateTimeInput(setDatePart(dateTimeInput, selected));
                        setErrors(prev => ({ ...prev, dateTime: undefined }));
                      } else {
                        setDeadlineInput(setDatePart(deadlineInput, selected));
                        setErrors(prev => ({ ...prev, registrationDeadline: undefined }));
                      }
                    }}
                    styles={{
                      day_label: { fontFamily: 'Inter_400Regular', color: '#0F172A' },
                      selected: { backgroundColor: '#2563EB', borderRadius: 20 },
                      selected_label: { fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
                      month_selector_label: { fontFamily: 'Inter_600SemiBold', color: '#0F172A', fontSize: 15 },
                      year_selector_label: { fontFamily: 'Inter_600SemiBold', color: '#0F172A', fontSize: 15 },
                      weekday_label: { fontFamily: 'Inter_500Medium', color: '#64748B', fontSize: 12 },
                      today: { borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 20 },
                      today_label: { fontFamily: 'Inter_700Bold', color: '#2563EB' },
                      disabled: { opacity: 0.3 },
                      disabled_label: { color: '#505459' },
                    }}
                  />
                ) : (
                  <DateTimePickerNative
                    display="spinner"
                    mode="time"
                    value={getPickerValue(activePicker)}
                    onChange={(event, selectedDate) =>
                      handlePickerChange(activePicker, event, selectedDate)
                    }
                    textColor="#0F172A"
                  />
                )}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Step progress bar ── */}
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s.label} style={styles.progressItem}>
            <View style={[
              styles.progressDot,
              i === step && styles.progressDotActive,
              i < step && styles.progressDotDone,
            ]}>
              {i < step
                ? <Ionicons name="checkmark" size={13} color="#fff" />
                : <Text style={[styles.progressNum, i === step && { color: '#fff' }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.progressLabel, i === step && styles.progressLabelActive]}>
              {s.label}
            </Text>
            {i < STEPS.length - 1 && (
              <View style={[styles.progressLine, i < step && styles.progressLineDone]} />
            )}
          </View>
        ))}
      </View>

      {/* ── Animated step content ── */}
      <Animated.View style={{
        opacity: slideAnim.interpolate({ inputRange: [-30, 0, 30], outputRange: [0, 1, 0] }),
        transform: [{ translateX: slideAnim }],
      }}>

        {/* ══ STEP 0: DETAILS ══ */}
        {step === 0 && (
          <View style={styles.stepContent}>

            {/* Cover image */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cover Images</Text>
              <Text style={styles.sectionSub}>Optional — adds visual appeal in the event feed</Text>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.coverZone, pressed && { opacity: 0.88 }]}
                onPress={() => void handlePickImage()}
              >
                {previewUri ? (
                  <>
                    <Image contentFit="cover" source={{ uri: previewUri }} style={styles.coverImg} transition={150} />
                    <View style={styles.coverOverlay}>
                      <Ionicons name="camera" size={20} color="#fff" />
                      <Text style={styles.coverOverlayText}>
                        {selectedImages.length > 0 ? 'Add More Photos' : 'Change Photo'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <View style={styles.coverPlaceholderIcon}>
                      <Ionicons name="image-outline" size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.coverPlaceholderTitle}>Add Cover Photos</Text>
                    <Text style={styles.coverPlaceholderSub}>JPG, PNG, WEBP · up to {EVENT_IMAGE_MAX_SIZE_LABEL} each</Text>
                  </View>
                )}
              </Pressable>

              {/* Images gallery - Horizontal scrollable
                  Shows the existing cover (if any, not removed) + all newly picked images */}
              {(selectedImages.length > 0 || existingImageUrls.length > 0) && (
                <View style={styles.galleryContainer}>
                  <ScrollView
                    ref={galleryScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    style={styles.galleryScroll}
                    contentContainerStyle={styles.galleryScrollContent}
                  >
                    {existingImageUrls.map((imageUrl, idx) => (
                      <View key={`existing-${idx}-${imageUrl}`} style={styles.galleryThumbWrap}>
                        <Pressable
                          style={[styles.galleryThumbnail, existingSelected && idx === existingImageIndex && styles.galleryThumbnailActive]}
                          onPress={() => {
                            setExistingImageIndex(idx);
                            setExistingSelected(true);
                          }}
                        >
                          <Image contentFit="cover" source={{ uri: imageUrl }} style={styles.galleryThumbImage} transition={150} />
                        </Pressable>
                        <Pressable
                          style={styles.galleryThumbRemoveBtn}
                          onPress={() => handleRemoveExistingImage(idx)}
                          hitSlop={6}
                        >
                          <Ionicons name="close" size={10} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                    {selectedImages.map((img, idx) => (
                      <View key={`${idx}-${img.fileName}`} style={styles.galleryThumbWrap}>
                        <Pressable
                          style={[styles.galleryThumbnail, !existingSelected && idx === selectedImageIndex && styles.galleryThumbnailActive]}
                          onPress={() => {
                            setSelectedImageIndex(idx);
                            setExistingSelected(false);
                            galleryScrollRef.current?.scrollTo({
                              x: idx * (60 + spacing.sm),
                              animated: true,
                            });
                          }}
                        >
                          <Image contentFit="cover" source={{ uri: img.uri }} style={styles.galleryThumbImage} transition={150} />
                        </Pressable>
                        <Pressable
                          style={styles.galleryThumbRemoveBtn}
                          onPress={() => handleRemoveImage(idx)}
                          hitSlop={6}
                        >
                          <Ionicons name="close" size={10} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {(previewUri || selectedImages.length > 0 || existingImageUrls.length > 0) && (
                <View style={styles.imageBtnGroup}>
                  <Pressable style={styles.removeImgBtn} onPress={() => void handlePickImage()}>
                    <Ionicons name="add-circle-outline" size={14} color="#2563EB" />
                    <Text style={styles.removeImgText} numberOfLines={1}>Add Photos</Text>
                  </Pressable>
                  {(selectedImages.length > 0 || existingImageUrls.length > 0) && (
                    <Pressable style={styles.removeImgBtn} onPress={handleClearAll}>
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      <Text style={[styles.removeImgText, { color: '#EF4444' }]}>Clear All</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {errors.coverImageUrl ? <Text style={styles.fieldError}>{errors.coverImageUrl}</Text> : null}
            </View>

            {/* Event details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Event Details</Text>

              <Field
                label="Event Name"
                required
                error={errors.title}
                icon="sparkles-outline"
                value={values.title}
                onChangeText={v => updateValue('title', v)}
                placeholder="e.g. TechSummit PH 2026"
                returnKeyType="next"
              />

              {/* Category selector */}
              <View style={styles.fieldWrap}>
                <FieldLabel text="Category" required />
                <View style={styles.categoryGrid}>
                  {categories.map(cat => {
                    const selected = values.category === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[styles.catChip, selected && styles.catChipSelected]}
                        onPress={() => updateValue('category', cat.id)}
                      >
                        <Text style={[styles.catChipText, selected && styles.catChipTextSelected]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.category ? <Text style={styles.fieldError}>{errors.category}</Text> : null}
              </View>

              <Field
                label="Location / Venue"
                required
                error={errors.location}
                icon="location-outline"
                value={values.location}
                onChangeText={v => updateValue('location', v)}
                placeholder="e.g. SM Mall of Asia, Manila"
              />

              <Field
                label="Capacity"
                required
                error={errors.capacity}
                icon="people-outline"
                value={capacityInput}
                onChangeText={v => { setCapacityInput(v); setErrors(p => ({ ...p, capacity: undefined })); }}
                placeholder="Max number of attendees"
                keyboardType="number-pad"
              />

              <Field
                label="Tags"
                hint="Separate with commas — e.g. music, students, workshop"
                icon="pricetag-outline"
                value={tagsInput}
                onChangeText={setTagsInput}
                placeholder="music, tech, free"
              />

              <Field
                label="Description"
                required
                error={errors.description}
                value={values.description}
                onChangeText={v => updateValue('description', v)}
                onFocus={onDescriptionFocus}
                placeholder="Describe your event — what attendees can expect, who it's for, etc."
                multiline
              />
            </View>

            <NavRow
              onBack={() => {}}
              onNext={goToStep1}
              nextLabel="Schedule"
              backDisabled
            />
          </View>
        )}

        {/* ══ STEP 1: SCHEDULE ══ */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Event Schedule</Text>
              <Text style={styles.sectionSub}>Choose the date and time for your event and registration deadline</Text>

              <View style={styles.hintBox}>
                <Ionicons name="information-circle-outline" size={16} color="#60A5FA" />
                <Text style={styles.hintBoxText}>
                  Registration must close before the event starts.
                </Text>
              </View>

              <View style={styles.scheduleGrid}>
                <PickerField
                  error={errors.dateTime}
                  icon="calendar-outline"
                  label="Event Date"
                  required
                  value={formatPickerDate(dateTimeInput)}
                  onPress={() => setActivePicker('eventDate')}
                />
                <PickerField
                  error={errors.dateTime}
                  icon="time-outline"
                  label="Event Time"
                  required
                  value={formatPickerTime(dateTimeInput)}
                  onPress={() => setActivePicker('eventTime')}
                />
              </View>

              <View style={styles.scheduleGrid}>
                <PickerField
                  error={errors.registrationDeadline}
                  icon="calendar-outline"
                  label="Registration Date"
                  required
                  value={formatPickerDate(deadlineInput)}
                  onPress={() => setActivePicker('deadlineDate')}
                />
                <PickerField
                  error={errors.registrationDeadline}
                  icon="time-outline"
                  label="Registration Time"
                  required
                  value={formatPickerTime(deadlineInput)}
                  onPress={() => setActivePicker('deadlineTime')}
                />
              </View>

              {parseDateTimeInput(dateTimeInput) && parseDateTimeInput(deadlineInput) &&
                isFutureIsoDate(parseDateTimeInput(dateTimeInput)) &&
                isFutureIsoDate(parseDateTimeInput(deadlineInput)) && (
                  <View style={styles.datePreview}>
                    <View style={styles.datePreviewRow}>
                      <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                      <Text style={styles.datePreviewText}>
                        Event: {new Date(parseDateTimeInput(dateTimeInput)).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </Text>
                    </View>
                    <View style={styles.datePreviewRow}>
                      <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                      <Text style={styles.datePreviewText}>
                        Registration: {new Date(parseDateTimeInput(deadlineInput)).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </Text>
                    </View>
                  </View>
                )}
            </View>

            <NavRow
              onBack={() => animateStep(0)}
              onNext={goToStep2}
              nextLabel="Review & Publish"
            />
          </View>
        )}

        {/* ══ STEP 2: REVIEW ══ */}
        {step === 2 && (
          <View style={styles.stepContent}>
            {previewUri ? (
              <View style={styles.reviewCoverWrap}>
                <Image contentFit="cover" source={{ uri: previewUri }} style={styles.reviewCover} transition={150} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.55)']}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.reviewCoverLabel}>
                  <Ionicons name="image-outline" size={13} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.reviewCoverLabelText}>Cover image added</Text>
                </View>
              </View>
            ) : (
              <View style={styles.reviewNoCover}>
                <Ionicons name="image-outline" size={16} color="#94A3B8" />
                <Text style={styles.reviewNoCoverText}>No cover image — you can add one later by editing this event.</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Review Details</Text>
              <View style={styles.reviewGrid}>
                <ReviewRow icon="sparkles-outline" label="Event Name" value={values.title} color="#60A5FA" />
                <ReviewRow icon="pricetag-outline" label="Category" value={categories.find(c => c.id === values.category)?.name ?? '—'} color="#FBBF24" />
                <ReviewRow icon="location-outline" label="Location" value={values.location} color="#34D399" />
                <ReviewRow icon="people-outline" label="Capacity" value={capacityInput ? `${capacityInput} attendees` : '—'} color="#A78BFA" />
                {tagsInput.trim() && (
                  <ReviewRow icon="pricetag-outline" label="Tags" value={tagsInput} color="#FB923C" />
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Schedule</Text>
              <View style={styles.reviewGrid}>
                <ReviewRow icon="calendar-outline" label="Event Date" value={dateTimeInput ? new Date(parseDateTimeInput(dateTimeInput) || '').toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} color="#60A5FA" />
                <ReviewRow icon="time-outline" label="Registration Closes" value={deadlineInput ? new Date(parseDateTimeInput(deadlineInput) || '').toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} color="#EF4444" />
              </View>
            </View>

            {values.description.trim() ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.reviewDesc} numberOfLines={4}>{values.description}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorCard}>
                <View style={styles.errorCardIcon}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorCardTitle}>Couldn't save this event</Text>
                  <Text style={styles.errorCardBody}>{errorMessage}</Text>
                </View>
              </View>
            ) : null}

            <NavRow
              onBack={() => animateStep(1)}
              onNext={() => void handleSubmit()}
              nextLabel={submitLabel}
              nextDisabled={isSubmitting}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.lg },

  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xxs,
    borderTopWidth: 0,
  },
  progressItem: { flex: 1, alignItems: 'center', position: 'relative' },
  progressDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 2, borderColor: '#BFDBFE',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  progressDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressDotDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  progressNum: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#94A3B8' },
  progressLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A3B8', textAlign: 'center' },
  progressLabelActive: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  progressLine: {
    position: 'absolute', top: 17, left: '66.5%', right: '-33.5%',
    height: 2, backgroundColor: '#E2E8F0',
  },
  progressLineDone: { backgroundColor: '#10B981' },

  stepContent: { gap: spacing.lg },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: '#F1F5F9',
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#0F172A' },
  sectionSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8', marginTop: -8 },

  coverZone: {
    borderRadius: radius.xl, overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed',
    height: 180,
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  coverOverlayText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
  coverPlaceholder: {
    height: '100%', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  coverPlaceholderIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  coverPlaceholderTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.primary },
  coverPlaceholderSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8' },

  galleryContainer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: -spacing.sm,   
    marginBottom: -spacing.xs,
  },
  galleryScroll: { flex: 1, height: 70 },
  galleryScrollContent: { alignItems: 'flex-end' },
  galleryThumbWrap: {
    width: 60, marginRight: spacing.sm,
    position: 'relative',
  },
  galleryThumbnail: {
    width: 60, height: 60, borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#E2E8F0',
  },
  galleryThumbnailActive: { borderColor: colors.primary, borderWidth: 3 },
  galleryThumbImage: { width: '100%', height: '100%' },
  galleryThumbRemoveBtn: {
    position: 'absolute', top: -8, right: -8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  imageBtnGroup: { flexDirection: 'row', gap: spacing.xs },
  removeImgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    flex: 1, justifyContent: 'center',
    backgroundColor: '#F8FAFC', borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  removeImgText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#2563EB' },

  fieldWrap: { gap: 0 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  catChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#64748B' },
  catChipTextSelected: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },

  fieldError: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.error, marginTop: 4 },

  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#BFDBFE',
    padding: spacing.md,
  },
  hintBoxText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1D4ED8', flex: 1, lineHeight: 19 },
  hintBoxCode: { fontFamily: 'Inter_700Bold' },
  scheduleGrid: { gap: spacing.md },
  pickerField: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
    overflow: 'hidden',
  },
  pickerFieldError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  pickerFieldIconWrap: {
    width: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  pickerFieldIconWrapError: { borderRightColor: '#FECACA', backgroundColor: '#FFF0F0' },
  pickerFieldValue: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#94A3B8',
    paddingHorizontal: spacing.md,
  },
  pickerFieldValueFilled: { color: '#0F172A' },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  pickerHeaderText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#334155' },
  pickerDoneBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  pickerDoneText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },
  pickerContainer: { backgroundColor: '#FFFFFF' },
  datePreview: {
    backgroundColor: '#ECFDF5', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#A7F3D0',
    padding: spacing.md, gap: 6,
  },
  datePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  datePreviewText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#065F46', flex: 1 },

  reviewCoverWrap: { borderRadius: radius.xl, overflow: 'hidden', height: 160 },
  reviewCover: { width: '100%', height: '100%' },
  reviewCoverLabel: {
    position: 'absolute', bottom: 10, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  reviewCoverLabelText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  reviewNoCover: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: spacing.md,
  },
  reviewNoCoverText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', flex: 1, lineHeight: 19 },
  reviewGrid: { gap: 14 },
  reviewDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#475569', lineHeight: 22 },

  errorCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: '#FECACA',
    padding: spacing.md,
  },
  errorCardIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  errorCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.error },
  errorCardBody: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#B91C1C', lineHeight: 19, marginTop: 2 },
});
