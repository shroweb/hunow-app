import { useEffect } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { AnimatedTabIcon } from "@/components/AnimatedTabIcon";
import { useSharedValue, withSpring, useAnimatedStyle } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function AnimatedCardIcon({ focused }: { focused: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 10, stiffness: 200, mass: 0.6 });
  }, [focused]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[style, {
      backgroundColor: focused ? YELLOW : "rgba(255,255,255,0.12)",
      borderRadius: 14, width: 44, height: 30,
      alignItems: "center", justifyContent: "center", marginTop: -2,
    }]}>
      <Ionicons name="card" size={18} color={focused ? NAV : "rgba(255,255,255,0.5)"} />
    </Animated.View>
  );
}

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          height: 64,
          borderRadius: 32,
          backgroundColor: "rgba(15,0,50,0.95)",
          borderTopWidth: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 16,
          paddingBottom: 0,
          paddingTop: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={20}
            tint="dark"
            style={{ flex: 1, borderRadius: 32, overflow: "hidden" }}
          />
        ),
        tabBarActiveTintColor: YELLOW,
        tabBarInactiveTintColor: "rgba(255,255,255,0.35)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 8, justifyContent: "center" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="venues"
        options={{
          title: "Offers",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="pricetag" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: "My Card",
          tabBarIcon: ({ focused }) => <AnimatedCardIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "Vouchers",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="ticket" color={color} size={size} focused={focused} />
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="venue/[id]" options={{ href: null }} />
      <Tabs.Screen name="event/[id]" options={{ href: null }} />
      <Tabs.Screen name="post/[id]" options={{ href: null }} />
    </Tabs>
  );
}
