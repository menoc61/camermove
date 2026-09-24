import * as Haptics from "expo-haptics";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

export type ToastVariant = "info" | "success" | "error" | "warning";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  (message: string, variant?: ToastVariant): void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastApi>(Object.assign(
  () => {},
  { success: () => {}, error: () => {}, warning: () => {} },
));

const VARIANT_GLYPH: Record<ToastVariant, string> = {
  info: "·",
  success: "✓",
  error: "!",
  warning: "▲",
};

const VARIANT_BG: Record<ToastVariant, string> = {
  info: colors.ink,
  success: "#1B5E20",
  error: "#B3261E",
  warning: "#8A6D1F",
};

/**
 * Bottom-anchored toast with slide-up + fade animation. Toasts are queued
 * FIFO with a default 3500ms lifetime; tapping the toast dismisses it.
 *
 * Reduced-motion: snap to visible instantly, no slide.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const reduced = useReduceMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++counterRef.current;
      setItems((prev) => {
        // Cap visible queue at 3 — older toasts get pushed off.
        const next = [...prev, { id, message, variant }];
        return next.length > 3 ? next.slice(next.length - 3) : next;
      });
      if (!reduced) {
        if (variant === "error") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (variant === "success") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => dismiss(id), 3500);
    },
    [dismiss, reduced],
  );

    const api = Object.assign(show, {
    success: (m: string) => show(m, "success"),
    error: (m: string) => show(m, "error"),
    warning: (m: string) => show(m, "warning"),
  }) as ToastApi;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={styles.layer}>
        {items.map((it) => (
          <ToastCard key={it.id} item={it} onDismiss={() => dismiss(it.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const reduced = useReduceMotion();
  const translateY = useSharedValue(reduced ? 0 : 40);
  const opacity = useSharedValue(reduced ? 1 : 0);
  const scale = useSharedValue(reduced ? 1 : 0.96);

  useEffect(() => {
    if (reduced) return;
    translateY.value = withSpring(0, {
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });
    opacity.value = withTiming(1, { duration: motion.duration.base, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    scale.value = withSpring(1, { damping: 20, stiffness: 260 });
  }, [opacity, reduced, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={item.message}
      onTouchEnd={onDismiss}
      style={[
        styles.banner,
        { backgroundColor: VARIANT_BG[item.variant] },
        animatedStyle,
      ]}
    >
      <View style={styles.glyph}>
        <Text style={styles.glyphText}>{VARIANT_GLYPH[item.variant]}</Text>
      </View>
      <Text style={styles.text}>{item.message}</Text>
    </Animated.View>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    gap: 8,
    alignItems: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
    minHeight: 48,
  },
  glyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphText: {
    color: colors.paper,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
  },
  text: {
    color: colors.paper,
    fontSize: 14,
    flex: 1,
  },
});
