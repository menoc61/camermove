/**
 * Motion primitives — single source of truth for durations, easings, and
 * reduce-motion handling. Mirrors web tokens (`docs/DESIGN-SYSTEM.md` §6)
 * while staying Reanimated-friendly.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export const motion = {
  duration: {
    fast: 160,
    base: 280,
    slow: 480,
  },
  easing: {
    out: "cubic-bezier(0.22, 1, 0.36, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  },
  /**
   * Returns a millisecond stagger offset that compounds with the reveal
   * primitive's base duration. Use as `motion.stagger(0)`, `motion.stagger(1)`,
   * `motion.stagger(2)` … to stagger successive children.
   *
   *   <Reveal delay={motion.stagger(0)}>…</Reveal>
   *   <Reveal delay={motion.stagger(1)}>…</Reveal>
   */
  stagger: (index: number): number => index * 80,
} as const;

/**
 * Subscribes to the platform reduce-motion preference. Returns `true` when the
 * user has requested reduced motion (matches web `prefers-reduced-motion`).
 *
 * Components that animate must respect this hook and collapse non-essential
 * animations to instant / no-op transitions.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });

    // The RN typings ship both a boolean overload (legacy) and an object overload;
// the runtime value is the same. Bypass TS strictness with a typed wrapper.
const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      ((event: unknown) => {
        if (!mounted) return;
        const value: boolean =
          typeof event === "boolean"
            ? event
            : Boolean(
                (event as { reduceMotionEnabled?: boolean }).reduceMotionEnabled ??
                  (event as { reduceMotionChanged?: boolean }).reduceMotionChanged,
              );
        setReduced(value);
      }) as never,
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * Returns a multiplier for spring/timing durations. When reduce-motion is on,
 * every transition collapses to instant (0ms) so layout still settles but
 * without visible movement.
 */
export function useMotionScale(): {
  duration: (base: number) => number;
  scale: number;
} {
  const reduced = useReduceMotion();
  return {
    duration: (base: number) => (reduced ? 0 : base),
    scale: reduced ? 0 : 1,
  };
}
