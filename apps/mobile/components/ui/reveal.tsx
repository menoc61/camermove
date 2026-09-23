import { useEffect } from "react";
import { type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { motion, useReduceMotion } from "@/lib/motion";

interface RevealProps {
  children: React.ReactNode;
  /** Delay (ms) before the animation begins. Use to stagger lists. */
  delay?: number;
  /** Direction of the entrance. Default `up` (slide + fade). */
  direction?: "up" | "down" | "left" | "right" | "none";
  /** Distance in px for the slide. Default 16. */
  distance?: number;
  style?: ViewStyle;
}

/**
 * Fades + slides its child into view on mount. Honors reduce-motion by
 * snapping to the final state instantly.
 */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  distance = 16,
  style,
}: RevealProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration: motion.duration.base }));
  }, [delay, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    let transform: { translateX: number } | { translateY: number } | undefined;
    if (direction === "up") transform = { translateY: (1 - t) * distance };
    else if (direction === "down") transform = { translateY: -(1 - t) * distance };
    else if (direction === "left") transform = { translateX: (1 - t) * distance };
    else if (direction === "right") transform = { translateX: -(1 - t) * distance };
    return {
      opacity: t,
      transform: transform ? [transform] : undefined,
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
