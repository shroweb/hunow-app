import { useEffect, useState } from "react";
import { View, Text, ScrollView, Share, TouchableOpacity, useWindowDimensions, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, withSpring, withTiming, useAnimatedStyle } from "react-native-reanimated";
import { useAuth } from "@/context/AuthContext";
import { PointsInfoModal } from "@/components/PointsInfoModal";
import type { WPRedemption } from "@/lib/wpAuth";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

const TIERS = [
  { name: "Standard", min: 0,    max: 499,  colour: "rgba(255,255,255,0.5)" },
  { name: "Bronze",   min: 500,  max: 999,  colour: "#CD7F32" },
  { name: "Silver",   min: 1000, max: 1999, colour: "#C0C0C0" },
  { name: "Gold",     min: 2000, max: 99999, colour: YELLOW },
];

function getTier(points: number) {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

function getNextTier(points: number) {
  return TIERS.find((t) => points < t.max) ?? null;
}

function memberNumber(token: string): string {
  const raw = token.replace(/-/g, "").slice(0, 12).toUpperCase();
  return raw.slice(0, 4) + " " + raw.slice(4, 8) + " " + raw.slice(8, 12);
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function groupRedemptionsByDate(redemptions: WPRedemption[]) {
  const groups: { label: string; items: WPRedemption[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const buckets: Record<string, WPRedemption[]> = {};

  for (const r of redemptions) {
    const d = new Date(r.date);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) {
      label = "Today";
    } else if (d.getTime() === yesterday.getTime()) {
      label = "Yesterday";
    } else {
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (diffDays < 7) {
        label = d.toLocaleDateString("en-GB", { weekday: "long" });
      } else {
        label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      }
    }
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(r);
  }

  // Maintain insertion order (most recent first)
  const seen = new Set<string>();
  for (const r of redemptions) {
    const d = new Date(r.date);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else {
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
      label = diffDays < 7
        ? d.toLocaleDateString("en-GB", { weekday: "long" })
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    if (!seen.has(label)) {
      seen.add(label);
      groups.push({ label, items: buckets[label] });
    }
  }
  return groups;
}

export default function MyCardScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = width - 32;
  const qrSize = Math.floor(cardWidth * 0.42);
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  if (!user) return null;

  const currentPoints = user.points ?? 0;
  const currentTier = getTier(currentPoints);
  const nextTier = getNextTier(currentPoints);
  const tierProgress = nextTier
    ? (currentPoints - currentTier.min) / (nextTier.min - currentTier.min)
    : 1;
  const ptsToNext = nextTier ? nextTier.min - currentPoints : 0;

  const redemptionGroups = groupRedemptionsByDate(user.redemptions ?? []);

  async function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message: `My HU NOW member card: ${memberNumber(user!.card_token)}` });
  }

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
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>My Card</Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 }}>
              {user.display_name}
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
          width: cardWidth, borderRadius: 28, backgroundColor: NAV, overflow: "hidden",
          shadowColor: YELLOW, shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.22, shadowRadius: 40, elevation: 24, marginBottom: 20,
        }}>
          {/* Top yellow bar */}
          <View style={{ height: 5, backgroundColor: YELLOW }} />

          {/* Decorative accents */}
          <View style={{
            position: "absolute", top: 5, right: -50, width: 160, height: 160,
            backgroundColor: YELLOW, opacity: 0.06, transform: [{ rotate: "35deg" }],
          }} />
          <View style={{
            position: "absolute", top: -20, right: 20, width: 120, height: 120,
            borderRadius: 60, backgroundColor: YELLOW, opacity: 0.05,
          }} />

          {/* Card header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 22, fontWeight: "900", letterSpacing: 0.5 }}>
              <Text style={{ color: YELLOW }}>HU </Text>
              <Text style={{ color: "white" }}>NOW</Text>
            </Text>
            {/* Tier badge */}
            <View style={{ backgroundColor: currentTier.colour + "22", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: currentTier.colour + "55" }}>
              <Text style={{ color: currentTier.colour, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
                {currentTier.name.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Animated QR section */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
            <Animated.View style={[{
              backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 20, padding: 20, alignItems: "center",
              shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
            }, qrAnimStyle]}>
              <QRCode value={user.card_token} size={qrSize} color={NAV} backgroundColor="transparent" />
              <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 11, marginTop: 14, letterSpacing: 0.8, textTransform: "uppercase" }}>
                Scan to verify membership
              </Text>
            </Animated.View>

            {/* Points pill */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
              <Ionicons name="star" size={13} color={YELLOW} />
              <Text style={{ color: YELLOW, fontWeight: "800", fontSize: 14 }}>{currentPoints}</Text>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: "600" }}>HU NOW Points</Text>
            </View>

            {/* Points Progress Bar */}
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                  {currentTier.name} → {nextTier?.name ?? "Max tier"}
                </Text>
                {nextTier && (
                  <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "700" }}>
                    {ptsToNext} pts to {nextTier.name}
                  </Text>
                )}
              </View>
              <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                <View style={{
                  height: "100%",
                  width: `${Math.min(tierProgress * 100, 100)}%`,
                  backgroundColor: currentTier.colour,
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
            <Text style={{ color: YELLOW, fontSize: 15, fontWeight: "800", letterSpacing: 2, marginBottom: 12 }}>
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

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          style={{
            backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18,
            paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center",
            marginBottom: 32, gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <Ionicons name="share-outline" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "700" }}>Share My Card</Text>
        </TouchableOpacity>

        {/* ── Redemption Timeline ── */}
        <Text style={{ color: "white", fontWeight: "800", fontSize: 17, marginBottom: 4 }}>Redemptions</Text>

        {redemptionGroups.length === 0 ? (
          <View style={{
            backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 32,
            alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
          }}>
            <Ionicons name="ticket-outline" size={40} color="rgba(255,255,255,0.15)" />
            <Text style={{ color: "white", fontSize: 15, fontWeight: "700", marginTop: 14, marginBottom: 6 }}>
              No redemptions yet
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
              Visit a HU NOW venue and scan your QR code to earn points.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(customer)/venues")}
              style={{
                backgroundColor: YELLOW, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginTop: 18,
              }}
            >
              <Text style={{ color: NAV, fontWeight: "800", fontSize: 14 }}>Browse Offers</Text>
            </TouchableOpacity>
          </View>
        ) : (
          redemptionGroups.map((group) => (
            <View key={group.label}>
              {/* Date section header */}
              <Text style={{
                color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "700",
                letterSpacing: 1.5, textTransform: "uppercase",
                marginTop: 16, marginBottom: 8,
              }}>
                {group.label}
              </Text>
              {group.items.map((r, i) => (
                <View key={i} style={{
                  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 14,
                  marginBottom: 8, flexDirection: "row", alignItems: "center",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
                  borderLeftWidth: 3, borderLeftColor: YELLOW,
                }}>
                  <View style={{
                    backgroundColor: YELLOW + "22", borderRadius: 12,
                    width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: 12,
                  }}>
                    <Ionicons name="ticket-outline" size={18} color={YELLOW} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
                      {r.offer_title}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                      {r.venue_name} · {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                  {/* Points pill */}
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Ionicons name="star" size={10} color={YELLOW} />
                    <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "800" }}>+35 pts</Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <PointsInfoModal
        visible={showPointsInfo}
        onClose={() => setShowPointsInfo(false)}
        currentPoints={currentPoints}
      />
    </SafeAreaView>
  );
}
