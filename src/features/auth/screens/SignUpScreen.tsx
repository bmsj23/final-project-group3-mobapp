import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isSupabaseConfigured } from '../../../lib/supabase/client';
import type { AuthStackParamList } from '../../../navigation/types';
import { useAppSession } from '../../../providers/AppSessionProvider';
import { colors } from '../../../theme/colors';
import type { AuthFormErrors, SignUpFormValues } from '../types';
import { isStrongEnoughPassword, isValidEmail } from '../validation';
import { styles } from './signUpScreen.styles';

type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: '', color: '#1E293B' };
  if (password.length < 6) return { level: 1, label: 'Weak', color: '#EF4444' };
  if (password.length < 10) return { level: 2, label: 'Fair', color: '#F59E0B' };
  return { level: 3, label: 'Strong', color: '#0F172A' };
}

export function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { clearError, errorMessage, signUp } = useAppSession();
  const [values, setValues] = useState<SignUpFormValues>({ fullName: '', email: '', password: '' });
  const [errors, setErrors] = useState<AuthFormErrors<keyof SignUpFormValues>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordStrength = getPasswordStrength(values.password);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const sheetY = useRef(new Animated.Value(80)).current;
  const sheetOp = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

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

  function triggerShake() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  function updateValue<K extends keyof SignUpFormValues>(key: K, val: SignUpFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validate() {
    const next: AuthFormErrors<keyof SignUpFormValues> = {};
    if (!values.fullName.trim()) next.fullName = 'Full name is required.';
    if (!isValidEmail(values.email)) next.email = 'Enter a valid email address.';
    if (!isStrongEnoughPassword(values.password)) next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    clearError();
    if (!isSupabaseConfigured) {
      setErrors({ email: 'App is not connected to a server. Contact your admin.' });
      triggerShake();
      return;
    }
    if (!validate()) {
      triggerShake();
      return;
    }
    setIsSubmitting(true);
    try {
      await signUp(values);
    } catch (error) {
      triggerShake();
      const message = error instanceof Error ? error.message : '';
      const isAlreadyRegistered =
        message.toLowerCase().includes('already registered') ||
        message.toLowerCase().includes('user already exists');
      setErrors((prev) => ({
        ...prev,
        email: isAlreadyRegistered
          ? 'This email is already registered. Check your inbox or sign in instead.'
          : message || 'Unable to create account. Try again.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <LinearGradient
        colors={['#0B1733', '#12305D', '#1D4E89', '#3B82C4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.keyboardBg} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'height' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.layout}>
          <Animated.View
            style={[styles.hero, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
            pointerEvents="box-none"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.55 }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={20} color="#CBD5E1" />
            </Pressable>

            <View style={styles.headlineBlock}>
              <Text style={styles.h1}>JOIN THE</Text>
              <View style={styles.h2Row}>
                <View style={styles.strokeWrap}>
                  <Text style={[styles.h2StrokeBase, styles.h2StrokeOutline]}>WAVE</Text>
                </View>
                <Text style={styles.h2Solid}> NOW</Text>
              </View>
              <Text style={styles.h3Accent}>Sign Up</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.sheet, { opacity: sheetOp, transform: [{ translateY: sheetY }] }]}>
            <ScrollView
              contentContainerStyle={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.sheetHead}>
                <View style={styles.sheetHeadCopy}>
                  <Text style={styles.sheetTitle}>Create Account</Text>
                  <Text style={styles.sheetSub}>Free to start and ready when you are.</Text>
                </View>
              </View>

              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <View style={[styles.inputShell, errors.fullName ? styles.inputError : null]}>
                    <View style={[styles.inputIcon, errors.fullName ? styles.inputIconError : null]}>
                      <Ionicons
                        name="person-outline"
                        size={17}
                        color={errors.fullName ? colors.error : '#0F172A'}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      value={values.fullName}
                      onChangeText={(v) => updateValue('fullName', v)}
                      onFocus={clearError}
                      placeholder="Your full name"
                      placeholderTextColor="#a5a5a5"
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                    {values.fullName.trim().length > 1 ? (
                      <View style={styles.validIcon}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                  {errors.fullName ? <Text style={styles.fieldError}>{errors.fullName}</Text> : null}
                </View>

                <View style={[styles.fieldWrap, styles.fieldGap]}>
                  <Text style={styles.fieldLabel}>Email address</Text>
                  <View style={[styles.inputShell, errors.email ? styles.inputError : null]}>
                    <View style={[styles.inputIcon, errors.email ? styles.inputIconError : null]}>
                      <Ionicons
                        name="mail-outline"
                        size={17}
                        color={errors.email ? colors.error : '#0F172A'}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      value={values.email}
                      onChangeText={(v) => updateValue('email', v)}
                      onFocus={clearError}
                      placeholder="you@example.com"
                      placeholderTextColor="#a5a5a5"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                    {values.email.length > 3 && isValidEmail(values.email) ? (
                      <View style={styles.validIcon}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                  {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
                </View>

                <View style={[styles.fieldWrap, styles.fieldGap]}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={[styles.inputShell, errors.password ? styles.inputError : null]}>
                    <View style={[styles.inputIcon, errors.password ? styles.inputIconError : null]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={17}
                        color={errors.password ? colors.error : '#0F172A'}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      value={values.password}
                      onChangeText={(v) => updateValue('password', v)}
                      onFocus={clearError}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#a5a5a5"
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={() => void handleSubmit()}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      onPress={() => setShowPassword((value) => !value)}
                      hitSlop={10}
                      style={styles.eyeBtn}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={18}
                        color="#0F172A"
                      />
                    </Pressable>
                  </View>
                  {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

                  {values.password.length > 0 ? (
                    <View style={styles.strengthWrap}>
                      <View style={styles.strengthBars}>
                        {([1, 2, 3] as const).map((level) => (
                          <View
                            key={level}
                            style={[
                              styles.strengthBar,
                              {
                                backgroundColor:
                                  passwordStrength.level >= level ? passwordStrength.color : '#1E293B',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>

              <Text style={styles.termsText}>
                By signing up you agree to our{' '}
                <Text style={styles.termsLink} onPress={() => navigation.navigate('TermsPolicy', { section: 'terms' })}>
                  Terms
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => navigation.navigate('TermsPolicy', { section: 'privacy' })}
                >
                  Privacy Policy
                </Text>
                .
              </Text>

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.88 },
                  isSubmitting && { opacity: 0.7 },
                ]}
                onPress={() => void handleSubmit()}
              >
                <View style={styles.btnFill}>
                  {isSubmitting ? (
                    <>
                      <View style={styles.dotsRow}>
                        {[0, 1, 2].map((index) => (
                          <View key={index} style={styles.dot} />
                        ))}
                      </View>
                      <Text style={styles.btnLabel}>Creating account...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.btnLabel}>Create Account</Text>
                      
                    </>
                  )}
                </View>
              </Pressable>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.signinBtn, pressed && { opacity: 0.7 }]}
                onPress={() => navigation.navigate('SignIn')}
              >
                <Text style={styles.signinText}>already have an account?</Text>
                <Text style={styles.signinLink}> Sign In</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
