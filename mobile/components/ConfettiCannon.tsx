import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue, withTiming, withDelay, useAnimatedStyle, Easing, runOnJS,
} from "react-native-reanimated";

const COLOURS = ["#FBC900", "#ffffff", "#0F0032", "#22C55E", "#FBC900", "#ffffff"];
const COUNT = 28;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface ParticleConfig {
  x: number;
  vx: number;
  colour: string;
  delay: number;
  duration: number;
  rotate: number;
}

interface Props {
  visible: boolean;
  onComplete?: () => void;
}

function Particle({ cfg }: { cfg: ParticleConfig }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (cfg.delay === 0 && cfg.duration === 0) return;
    opacity.value = withDelay(cfg.delay, withTiming(1, { duration: 100 }));
    translateY.value = withDelay(
      cfg.delay,
      withTiming(-cfg.duration * 0.4, { duration: cfg.duration, easing: Easing.out(Easing.quad) }),
    );
    translateX.value = withDelay(
      cfg.delay,
      withTiming(cfg.vx, { duration: cfg.duration, easing: Easing.inOut(Easing.sin) }),
    );
    rotate.value = withDelay(
      cfg.delay,
      withTiming(cfg.rotate, { duration: cfg.duration }),
    );
    opacity.value = withDelay(
      cfg.delay + cfg.duration * 0.6,
      withTiming(0, { duration: cfg.duration * 0.4 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: "50%",
          bottom: 80,
          width: 6,
          height: 10,
          borderRadius: 2,
          backgroundColor: cfg.colour,
          marginLeft: cfg.x,
        },
        style,
      ]}
    />
  );
}

export function ConfettiCannon({ visible, onComplete }: Props) {
  const particles = useRef<ParticleConfig[]>(
    Array.from({ length: COUNT }, (_, i) => ({
      x: randomBetween(-60, 60),
      vx: randomBetween(-120, 120),
      colour: COLOURS[i % COLOURS.length],
      delay: randomBetween(0, 200),
      duration: randomBetween(900, 1400),
      rotate: randomBetween(-360, 360),
    })),
  );

  useEffect(() => {
    if (visible && onComplete) {
      const t = setTimeout(onComplete, 1800);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.current.map((cfg, i) => (
        <Particle key={i} cfg={cfg} />
      ))}
    </View>
  );
}
