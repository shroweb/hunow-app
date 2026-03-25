import { useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSharedValue, withSpring, useAnimatedStyle } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { markOnboardingComplete } from "@/lib/onboarding";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

const SLIDES = [
  {
    icon: "card-outline" as const,
    title: "Your Hull\nCity Card",
    body: "One app. Hundreds of exclusive deals at Hull's best venues.",
    bg: NAV,
  },
  {
    icon: "star-outline" as const,
    title: "Earn Points\nEvery Visit",
    body: "Redeem offers and earn points towards bigger rewards each time you visit.",
    bg: "#0a0025",
  },
  {
    icon: "pricetag-outline" as const,
    title: "Exclusive\nMember Deals",
    body: "Unlock offers only available to HU NOW card holders across the city.",
    bg: "#06001a",
  },
];

function DotIndicator({ count, active }: { count: number; active: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: count }).map((_, i) => {
        const width = useSharedValue(i === active ? 24 : 8);
        const widthStyle = useAnimatedStyle(() => ({ width: width.value }));
        // Animate when active changes
        if (i === active) {
          width.value = withSpring(24, { damping: 12, stiffness: 200 });
        } else {
          width.value = withSpring(8, { damping: 12, stiffness: 200 });
        }
        return (
          <Animated.View
            key={i}
            style={[
              {
                height: 8, borderRadius: 4,
                backgroundColor: i === active ? YELLOW : "rgba(255,255,255,0.25)",
              },
              widthStyle,
            ]}
          />
        );
      })}
    </View>
  );
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  function handleScroll(e: any) {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentPage(page);
  }

  async function finish(target: "register" | "login") {
    await markOnboardingComplete();
    router.replace(target === "register" ? "/(auth)/register" : "/(auth)/login");
  }

  function nextPage() {
    if (currentPage < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (currentPage + 1), animated: true });
    }
  }

  const isLast = currentPage === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: SLIDES[currentPage]?.bg ?? NAV }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Skip button */}
        {!isLast && (
          <TouchableOpacity
            onPress={() => finish("login")}
            style={{ position: "absolute", top: 56, right: 24, zIndex: 10, padding: 8 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: "600" }}>Skip</Text>
          </TouchableOpacity>
        )}

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {SLIDES.map((slide, i) => (
            <View
              key={i}
              style={{
                width, flex: 1,
                alignItems: "center", justifyContent: "center",
                paddingHorizontal: 40,
                backgroundColor: slide.bg,
              }}
            >
              {/* Icon circle */}
              <View style={{
                width: 120, height: 120, borderRadius: 60,
                backgroundColor: YELLOW + "18",
                alignItems: "center", justifyContent: "center",
                marginBottom: 40,
                borderWidth: 1.5, borderColor: YELLOW + "33",
              }}>
                <Ionicons name={slide.icon} size={52} color={YELLOW} />
              </View>

              <Text style={{
                color: "white", fontSize: 38, fontWeight: "900",
                textAlign: "center", lineHeight: 44, letterSpacing: -1,
                marginBottom: 20,
              }}>
                {slide.title}
              </Text>
              <Text style={{
                color: "rgba(255,255,255,0.5)", fontSize: 16,
                textAlign: "center", lineHeight: 24,
              }}>
                {slide.body}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Bottom controls */}
        <View style={{ paddingHorizontal: 28, paddingBottom: 40, gap: 20 }}>
          <DotIndicator count={SLIDES.length} active={currentPage} />

          {isLast ? (
            <>
              <TouchableOpacity
                onPress={() => finish("register")}
                style={{
                  backgroundColor: YELLOW, borderRadius: 20,
                  paddingVertical: 16, alignItems: "center",
                  shadowColor: YELLOW, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
                }}
              >
                <Text style={{ color: NAV, fontWeight: "900", fontSize: 17 }}>Create My Card</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => finish("login")} style={{ alignItems: "center", paddingVertical: 4 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
                  Already have an account? <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "700" }}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={nextPage}
              style={{
                backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20,
                paddingVertical: 16, alignItems: "center", flexDirection: "row",
                justifyContent: "center", gap: 8,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
