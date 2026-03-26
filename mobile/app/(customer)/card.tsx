import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, withSpring, withTiming, useAnimatedStyle } from "react-native-reanimated";
import { useAuth } from "@/context/AuthContext";
import { PointsInfoModal } from "@/components/PointsInfoModal";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const SEEN_TIER_KEY = "hunow_seen_member_tier";
const BRAND_LOGO_URL = "https://hunow.co.uk/wp-content/uploads/2025/02/Group-1-1.png";

const TIERS = [
  { name: "Standard", min: 0,    max: 199,  colour: "rgba(255,255,255,0.5)", icon: "ellipse" as const },
  { name: "Bronze",   min: 200,  max: 599,  colour: "#CD7F32", icon: "medal-outline" as const },
  { name: "Silver",   min: 600, max: 1399, colour: "#C0C0C0", icon: "diamond-outline" as const },
  { name: "Gold",     min: 1400, max: 99999, colour: YELLOW, icon: "trophy-outline" as const },
];

function getTier(points: number) {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

function getTierByKey(tier?: string | null) {
  if (!tier) return null;
  const normalized = tier.toLowerCase();
  return TIERS.find((item) => item.name.toLowerCase() === normalized) ?? null;
}

function getNextTier(points: number) {
  return TIERS.find((t) => t.min > points) ?? null;
}

function memberNumber(token: string): string {
  const raw = token.replace(/-/g, "").slice(0, 12).toUpperCase();
  return raw.slice(0, 4) + " " + raw.slice(4, 8) + " " + raw.slice(8, 12);
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function MyCardScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = width - 32;
  const qrSize = Math.floor(cardWidth * 0.42);
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [celebrationTier, setCelebrationTier] = useState<string | null>(null);

  // QR reveal animation
  const qrScale = useSharedValue(0);
  const qrOpacity = useSharedValue(0);

  useEffect(() => {
    qrScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    qrOpacity.value = withTiming(1, { duration: 400 });
  }, []);

  const qrAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: qrScale.value }],
    opacity: qrOpacity.value,
  }));

  async function onRefresh() {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  }

  useEffect(() => {
    if (!user) return;
    const currentTierName = (getTierByKey(user.tier) ?? getTier(user.points ?? 0)).name;
    async function maybeCelebrateTier() {
      const seenTier = await AsyncStorage.getItem(SEEN_TIER_KEY);
      if (seenTier !== currentTierName) {
        if (currentTierName !== "Standard") {
          setCelebrationTier(currentTierName);
        }
        await AsyncStorage.setItem(SEEN_TIER_KEY, currentTierName);
      }
    }
    maybeCelebrateTier();
  }, [user]);

  if (!user) return null;

  const currentPoints = user.points ?? 0;
  const currentTier = getTierByKey(user.tier) ?? getTier(currentPoints);
  const nextTier = getNextTier(currentPoints);
  const tierProgress = nextTier
    ? (currentPoints - currentTier.min) / (nextTier.min - currentTier.min)
    : 1;
  const ptsToNext = nextTier ? nextTier.min - currentPoints : 0;
  const tierTheme = currentTier.name === "Gold"
    ? { base: "#11031F", accent: "#FBC900", secondary: "#5B4300" }
    : currentTier.name === "Silver"
      ? { base: "#111827", accent: "#C0C0C0", secondary: "#334155" }
      : currentTier.name === "Bronze"
        ? { base: "#1A0A08", accent: "#CD7F32", secondary: "#5A2D12" }
        : { base: "#0F0032", accent: YELLOW, secondary: "#24105C" };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#080018" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={YELLOW}
            title="Refreshing..."
            titleColor="rgba(255,255,255,0.4)"
          />
        }
      >
        {/* Screen header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <View>
            <Image
              source={{ uri: BRAND_LOGO_URL }}
              style={{ width: 112, height: 52, marginLeft: -18, marginBottom: 10, alignSelf: "flex-start" }}
              resizeMode="contain"
            />
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>My Card</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" }}>
              Your HU NOW membership
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Points info button */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPointsInfo(true); }}
              style={{
                backgroundColor: YELLOW + "22", borderRadius: 20,
                width: 40, height: 40, alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="information-circle-outline" size={20} color={YELLOW} />
            </TouchableOpacity>
            {/* Profile button */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(customer)/profile" as any); }}
              style={{
                backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20,
                width: 40, height: 40, alignItems: "center", justifyContent: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Premium Card ── */}
        <View style={{
          width: cardWidth, borderRadius: 30, backgroundColor: tierTheme.base, overflow: "hidden",
          shadowColor: tierTheme.accent, shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.22, shadowRadius: 40, elevation: 24, marginBottom: 20,
        }}>
          {/* Top yellow bar */}
          <View style={{ height: 5, backgroundColor: tierTheme.accent }} />

          {/* Decorative accents */}
          <View style={{
            position: "absolute", top: 5, right: -50, width: 160, height: 160,
            backgroundColor: tierTheme.accent, opacity: 0.08, transform: [{ rotate: "35deg" }],
          }} />
          <View style={{
            position: "absolute", top: -20, right: 20, width: 120, height: 120,
            borderRadius: 60, backgroundColor: tierTheme.accent, opacity: 0.05,
          }} />
          <View style={{
            position: "absolute", top: 60, left: -40, width: 220, height: 220,
            borderRadius: 110, backgroundColor: tierTheme.secondary, opacity: 0.22,
          }} />
          <View style={{
            position: "absolute", top: 18, left: -30, right: -30, height: 70,
            backgroundColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "-7deg" }],
          }} />
          <View style={{
            position: "absolute", top: -10, left: 30, right: 30, height: 120,
            borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)",
          }} />
          <View style={{
            position: "absolute", bottom: -50, right: -10, width: 220, height: 220,
            borderRadius: 110, backgroundColor: tierTheme.accent, opacity: 0.06,
          }} />

          {/* Card header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 10, fontWeight: "700", letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 4 }}>
                Member Pass
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "900", letterSpacing: 0.5 }}>
                <Text style={{ color: tierTheme.accent }}>HU </Text>
                <Text style={{ color: "white" }}>NOW</Text>
              </Text>
            </View>
            {/* Tier badge */}
            <View style={{ backgroundColor: currentTier.colour + "18", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: currentTier.colour + "55" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name={currentTier.icon} size={12} color={currentTier.colour} />
                <Text style={{ color: currentTier.colour, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
                  {currentTier.name.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* Animated QR section */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: "white", fontSize: 21, fontWeight: "900", marginBottom: 4 }} numberOfLines={1}>
                {user.display_name}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, lineHeight: 17 }}>
                Show this card when you redeem rewards or check in at partner venues.
              </Text>
            </View>
            <Animated.View style={[{
              backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 24, padding: 20, alignItems: "center",
              shadowColor: tierTheme.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18,
            }, qrAnimStyle]}>
              <QRCode value={user.card_token} size={qrSize} color={NAV} backgroundColor="transparent" />
              <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 11, marginTop: 14, letterSpacing: 0.8, textTransform: "uppercase" }}>
                Scan to verify membership
              </Text>
            </Animated.View>

            {/* Points pill */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="star" size={13} color={YELLOW} />
                <Text style={{ color: tierTheme.accent, fontWeight: "800", fontSize: 14 }}>{currentPoints}</Text>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: "600" }}>HU NOW Points</Text>
              </View>
              <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700" }}>
                  {nextTier ? `${ptsToNext} to ${nextTier.name}` : "Top tier unlocked"}
                </Text>
              </View>
            </View>

            {/* Points Progress Bar */}
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                  {nextTier ? `${currentTier.name} -> ${nextTier.name}` : `${currentTier.name} member`}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                <View style={{
                  height: "100%",
                  width: `${Math.min(tierProgress * 100, 100)}%`,
                  backgroundColor: tierTheme.accent,
                  borderRadius: 3,
                }} />
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 24 }} />

          {/* Card footer */}
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }}>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 }}>Member Number</Text>
            <Text style={{ color: tierTheme.accent, fontSize: 15, fontWeight: "800", letterSpacing: 2, marginBottom: 12 }}>
              {memberNumber(user.card_token)}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
              <View>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Member Since</Text>
                <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
                  {user.card_created ? memberSince(user.card_created) : "—"}
                </Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: "700" }}>hunow.co.uk</Text>
            </View>
          </View>
        </View>

        {celebrationTier && (
          <TouchableOpacity
            onPress={() => setCelebrationTier(null)}
            style={{
              backgroundColor: YELLOW, borderRadius: 18, padding: 16, marginBottom: 24,
              borderWidth: 1, borderColor: YELLOW, shadowColor: YELLOW,
              shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16,
            }}
          >
            <Text style={{ color: NAV, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
              New Tier Unlocked
            </Text>
            <Text style={{ color: NAV, fontSize: 18, fontWeight: "900", marginBottom: 4 }}>
              Welcome to {celebrationTier}
            </Text>
            <Text style={{ color: "rgba(15,0,50,0.7)", fontSize: 13, lineHeight: 18 }}>
              You can now unlock more venue rewards across HU NOW. Check venue pages to see what&apos;s newly available.
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <PointsInfoModal
        visible={showPointsInfo}
        onClose={() => setShowPointsInfo(false)}
        currentPoints={currentPoints}
      />
    </SafeAreaView>
  );
}
