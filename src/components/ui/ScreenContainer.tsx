import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { layout } from '../../theme/layout';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** When true, removes default padding (useful for full-bleed headers). */
  noPadding?: boolean;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  /**
   * Background color of the SafeAreaView shell. Used by full-bleed screens
   * (noPadding) to match the dark hero color so pull-to-refresh overscroll
   * shows the hero color instead of white.
   */
  bg?: string;
};

export function ScreenContainer({
  children,
  scroll = false,
  contentContainerStyle,
  noPadding = false,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  bg,
}: ScreenContainerProps) {
  const paddingStyle = noPadding
    ? undefined
    : { paddingHorizontal: layout.screenPaddingH, paddingVertical: layout.screenPaddingV };

  // noPadding screens (full-bleed headers) manage their own top inset internally.
  const safeAreaEdges = noPadding ? [] : (['top'] as const);
  const bgStyle = bg ? { backgroundColor: bg } : undefined;

  const content = scroll ? (
    <ScrollView
      alwaysBounceVertical={false}
      bounces={false}
      contentContainerStyle={[styles.scrollContent, paddingStyle, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      style={[styles.scrollView, bgStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, paddingStyle, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={safeAreaEdges} style={[styles.safeArea, bgStyle]}>
      {/* White backing prevents the colored safeArea bg from showing through keyboard rounded corners */}
      {bg ? <View pointerEvents="none" style={styles.keyboardBackground} /> : null}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.keyboardAvoider}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollView: {
    backgroundColor: colors.background,
  },
  keyboardAvoider: {
    flex: 1,
  },
  keyboardBackground: {
    backgroundColor: colors.background,
    bottom: 0,
    height: 400,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
