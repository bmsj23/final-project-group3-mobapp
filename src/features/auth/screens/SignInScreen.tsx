import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import type { AuthFormErrors, SignInFormValues } from '../types';
import { isValidEmail } from '../validation';
import { styles } from './signInScreen.styles';

type SignInScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: SignInScreenProps) {
  const { clearError, errorMessage, signIn } = useAppSession();
  const [values, setValues] = useState<SignInFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<AuthFormErrors<keyof SignInFormValues>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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

  function updateValue<K extends keyof SignInFormValues>(key: K, val: SignInFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validate() {
    const next: AuthFormErrors<keyof SignInFormValues> = {};
    if (!isValidEmail(values.email)) next.email = 'Enter a valid email address.';
    if (!values.password.trim()) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    clearError();
    if (!isSupabaseConfigured) {
      setErrors({ password: 'App is not connected to a server. Contact your admin.' });
      triggerShake();
      return;
    }
    if (!validate()) {
      triggerShake();
      return;
    }
    setIsSubmitting(true);
    try {
      await signIn(values);
    } catch (error) {
      triggerShake();
      setErrors((prev) => ({
        ...prev,
        password: error instanceof Error ? error.message : 'Unable to sign in. Try again.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleForgotPassword() {
    Alert.alert('Reset Password', "We'll send a reset link to your email address.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send Link',
        onPress: () => {
          if (!isValidEmail(values.email)) {
            Alert.alert('Heads up', 'Enter your email above first, then tap Forgot Password.');
            return;
          }
          Alert.alert('Link Sent', `Check your inbox at ${values.email}`);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <LinearGradient
        colors={['#0B1733', '#12305D', '#1D4E89', '#3B82C4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.layout}>
          <Animated.View style={[styles.hero, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.55 }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={20} color="#CBD5E1" />
            </Pressable>

            <View style={styles.headlineBlock}>
              <Text style={styles.h1}>WELCOME</Text>
              <View style={styles.h2Row}>
                <View style={styles.strokeWrap}>
                  <Text style={[styles.h2StrokeBase, styles.h2StrokeOutline]}>BACK</Text>
                </View>
                <Text style={styles.h2Solid}> IN</Text>
              </View>
              <Text style={styles.h3Accent}>Sign In</Text>
              <Text style={styles.heroSubcopy}>
                Pick up where you left off and get back to your next event.
              </Text>

              <View style={styles.topTagRow}>
                {['Discover', 'Book', 'Vibe'].map((item) => (
                  <Text key={item} style={styles.topTagText}>
                    • {item}
                  </Text>
                ))}
              </View>
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
                  <Text style={styles.sheetTitle}>You are back</Text>
                  <Text style={styles.sheetSub}>Your next plan is already loading.</Text>
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

                <View style={styles.fieldWrap}>
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
                      placeholder="Enter your password"
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
                </View>
              </Animated.View>

              <View style={styles.inlineRow}>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: rememberMe }}
                  style={styles.rememberRow}
                  onPress={() => setRememberMe((value) => !value)}
                >
                  <View style={[styles.toggle, rememberMe && styles.toggleOn]}>
                    <View style={[styles.knob, rememberMe && styles.knobRight]} />
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </Pressable>
                <Pressable onPress={handleForgotPassword} hitSlop={8}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

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
                      <Text style={styles.btnLabel}>Signing in...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.btnLabel}>Let&apos;s Go</Text>
                      
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
                style={({ pressed }) => [styles.signupBtn, pressed && { opacity: 0.7 }]}
                onPress={() => navigation.navigate('SignUp')}
              >
                <Text style={styles.signupText}>New here?</Text>
                <Text style={styles.signupLink}> Create an account</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
