import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

interface LottieIllustrationProps {
  /** "bus", "hotel", "parcel", "ticket", "empty", "loading". */
  preset: "bus" | "hotel" | "parcel" | "ticket" | "empty" | "loading";
  size?: number;
  tint?: string;
  style?: ViewStyle;
  autoLoop?: boolean;
}

/**
 * Lightweight Lottie-style illustration primitive. Each preset is a layered
 * set of animated shapes driven by Reanimated, so the same component plays
 * the same animations regardless of native Lottie availability.
 *
 * Reduces to a static tinted shape under reduce-motion.
 */
export function LottieIllustration({
  preset,
  size = 96,
  tint = colors.ink,
  style,
  autoLoop = true,
}: LottieIllustrationProps) {
  const reduced = useReduceMotion();

  if (preset === "loading") {
    return <LoadingOrb size={size} tint={tint} style={style} />;
  }

  return (
    <View style={[styles.frame, { width: size, height: size }, style]}>
      {preset === "bus" ? (
        <BusShape size={size} tint={tint} reduced={reduced} autoLoop={autoLoop} />
      ) : null}
      {preset === "hotel" ? (
        <HotelShape size={size} tint={tint} reduced={reduced} autoLoop={autoLoop} />
      ) : null}
      {preset === "parcel" ? (
        <ParcelShape size={size} tint={tint} reduced={reduced} autoLoop={autoLoop} />
      ) : null}
      {preset === "ticket" ? (
        <TicketShape size={size} tint={tint} reduced={reduced} autoLoop={autoLoop} />
      ) : null}
      {preset === "empty" ? (
        <EmptyShape size={size} tint={tint} reduced={reduced} />
      ) : null}
    </View>
  );
}

function BusShape({
  size,
  tint,
  reduced,
  autoLoop,
}: {
  size: number;
  tint: string;
  reduced: boolean;
  autoLoop: boolean;
}) {
  const wobble = useSharedValue(0);
  useEffect(() => {
    if (reduced || !autoLoop) return;
    wobble.value = withRepeat(
      withSequence(
        withTiming(-0.04, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.04, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [autoLoop, reduced, wobble]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: wobble.value * size * 0.06 }, { rotate: `${wobble.value}rad` }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: size * 0.85,
          height: size * 0.6,
          backgroundColor: tint,
          borderRadius: 0,
          position: "relative",
        },
        animStyle,
      ]}
    >
      <View style={[styles.windowRow, { top: size * 0.12, left: size * 0.06 }]}>
        <View style={[styles.window, { backgroundColor: colors.paper, width: size * 0.16, height: size * 0.16 }]} />
        <View style={[styles.window, { backgroundColor: colors.paper, width: size * 0.16, height: size * 0.16 }]} />
      </View>
      <View
        style={[
          styles.wheel,
          { left: size * 0.14, bottom: -size * 0.06, backgroundColor: tint },
        ]}
      />
      <View
        style={[
          styles.wheel,
          { right: size * 0.14, bottom: -size * 0.06, backgroundColor: tint },
        ]}
      />
    </Animated.View>
  );
}

function HotelShape({
  size,
  tint,
  reduced,
  autoLoop,
}: {
  size: number;
  tint: string;
  reduced: boolean;
  autoLoop: boolean;
}) {
  const blink = useSharedValue(0);
  useEffect(() => {
    if (reduced || !autoLoop) return;
    blink.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 800 }),
        withTiming(1, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, [autoLoop, blink, reduced]);
  const starStyle = useAnimatedStyle(() => ({ opacity: 1 - blink.value }));
  return (
    <View
      style={[
        {
          width: size * 0.78,
          height: size * 0.86,
          backgroundColor: tint,
          borderRadius: 0,
          padding: size * 0.1,
          justifyContent: "space-between",
        },
      ]}
    >
      <View style={{ gap: size * 0.06 }}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={{ flexDirection: "row", gap: size * 0.06 }}>
            {[0, 1].map((col) => (
              <View
                key={col}
                style={{
                  width: size * 0.18,
                  height: size * 0.14,
                  backgroundColor: colors.paper,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: -size * 0.18,
            right: size * 0.06,
            width: size * 0.18,
            height: size * 0.18,
            alignItems: "center",
            justifyContent: "center",
          },
          starStyle,
        ]}
      >
        <View
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            borderLeftWidth: size * 0.09,
            borderRightWidth: size * 0.09,
            borderBottomWidth: size * 0.14,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: colors.woodDark,
          }}
        />
      </Animated.View>
    </View>
  );
}

function ParcelShape({
  size,
  tint,
  reduced,
  autoLoop,
}: {
  size: number;
  tint: string;
  reduced: boolean;
  autoLoop: boolean;
}) {
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduced || !autoLoop) return;
    bob.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [autoLoop, bob, reduced]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * size * 0.04 }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: size * 0.78,
          height: size * 0.78,
          backgroundColor: tint,
          position: "relative",
        },
        a,
      ]}
    >
      <View
        style={{
          position: "absolute",
          top: size * 0.4,
          left: 0,
          right: 0,
          height: size * 0.05,
          backgroundColor: colors.woodDark,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: size * 0.36,
          width: size * 0.05,
          backgroundColor: colors.woodDark,
        }}
      />
    </Animated.View>
  );
}

function TicketShape({
  size,
  tint,
  reduced,
  autoLoop,
}: {
  size: number;
  tint: string;
  reduced: boolean;
  autoLoop: boolean;
}) {
  const wave = useSharedValue(0);
  useEffect(() => {
    if (reduced || !autoLoop) return;
    wave.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [autoLoop, reduced, wave]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateY: (wave.value - 0.5) * -size * 0.05 }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: size * 0.9,
          height: size * 0.5,
          backgroundColor: tint,
          padding: size * 0.08,
          gap: size * 0.04,
        },
        a,
      ]}
    >
      <View style={{ width: "60%", height: size * 0.04, backgroundColor: colors.paper }} />
      <View style={{ width: "85%", height: size * 0.04, backgroundColor: colors.paper }} />
      <View style={{ width: "40%", height: size * 0.04, backgroundColor: colors.paper }} />
    </Animated.View>
  );
}

function EmptyShape({
  size,
  tint,
  reduced,
}: {
  size: number;
  tint: string;
  reduced: boolean;
}) {
  const pulse = useSharedValue(reduced ? 1 : 0.92);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.92, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [pulse, reduced]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View
      style={[
        {
          width: size * 0.8,
          height: size * 0.8,
          borderWidth: 1,
          borderColor: tint,
          alignItems: "center",
          justifyContent: "center",
        },
        a,
      ]}
    >
      <View
        style={{
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: 0,
          backgroundColor: tint,
        }}
      />
    </Animated.View>
  );
}

function LoadingOrb({ size, tint, style }: { size: number; tint: string; style?: ViewStyle }) {
  const reduced = useReduceMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [reduced, spin]);
  const a = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderWidth: 2,
          borderTopColor: tint,
          borderRightColor: tint,
          borderBottomColor: "transparent",
          borderLeftColor: "transparent",
          borderRadius: size / 2,
        },
        a,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center" },
  windowRow: {
    position: "absolute",
    flexDirection: "row",
    gap: 4,
  },
  window: {},
  wheel: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.paper,
  },
});
