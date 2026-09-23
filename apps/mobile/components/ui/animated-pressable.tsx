import { useCallback } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion, useReduceMotion } from "@/lib/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressFeedbackProps extends Omit<PressableProps, "style"> {
  /** Whether to fire a subtle haptic on press. Default true for primary CTAs. */
  haptic?: boolean;
  /** Visual scale on press (1 = no scale). */
  pressedScale?: number;
  style?: ViewStyle | ViewStyle[] | StyleProp<ViewStyle> | boolean | number | null | undefined;
}

/**
 * Pressable wrapper that:
 * - fades opacity to 0.7 and scales down by `pressedScale` while pressed
 * - fires an impact haptic (Light) on press unless `haptic={false}`
 * - respects `prefers-reduced-motion` — animations collapse to instant
 *
 * Use this anywhere a button-like element needs tactile + visual feedback
 * (cards, chips, list rows, primary buttons).
 */
export function AnimatedPressFeedback({
  haptic = true,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  style,
  disabled,
  ...rest
}: AnimatedPressFeedbackProps) {
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);

  const onPressInWrapped = useCallback(
    (event: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      pressed.value = withTiming(reduceMotion ? 0 : 1, { duration: motion.duration.fast });
      onPressIn?.(event);
    },
    [onPressIn, pressed, reduceMotion],
  );

  const onPressOutWrapped = useCallback(
    (event: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      pressed.value = withTiming(0, { duration: motion.duration.fast });
      onPressOut?.(event);
    },
    [onPressOut, pressed],
  );

  const handlePress = useCallback<NonNullable<PressableProps["onPress"]>>(
    (event) => {
      if (haptic && !reduceMotion) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      rest.onPress?.(event);
    },
    [haptic, reduceMotion, rest],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - pressedScale) }],
    opacity: 1 - pressed.value * 0.15,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={onPressInWrapped}
      onPressOut={onPressOutWrapped}
      style={[style as ViewStyle, animatedStyle]}
    />
  );
}
