import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import type { WPRedemption } from "@/lib/wpAuth";
import { formatOfferRule } from "@/lib/wordpress";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const BORDER = "rgba(255,255,255,0.08)";

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
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else {
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
      label = diffDays < 7
        ? d.toLocaleDateString("en-GB", { weekday: "long" })
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(r);
  }

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

type HistoryFilter = "all" | "standard" | "tier";

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const redemptions = user?.redemptions ?? [];
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("all");
  const filteredRedemptions = useMemo(() => {
    if (activeFilter === "standard") return redemptions.filter((r) => !r.tier);
    if (activeFilter === "tier") return redemptions.filter((r) => !!r.tier);
    return redemptions;
  }, [activeFilter, redemptions]);
  const redemptionGroups = useMemo(() => groupRedemptionsByDate(filteredRedemptions), [filteredRedemptions]);
  const uniqueVenueCount = useMemo(() => new Set(filteredRedemptions.map((r) => r.venue_id)).size, [filteredRedemptions]);
  const tierRedemptionCount = useMemo(() => filteredRedemptions.filter((r) => !!r.tier).length, [filteredRedemptions]);
  const latestRedemption = filteredRedemptions[0] ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 }}>
          <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>Your Activity</Text>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 }}>History</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 }}>
            Every offer redemption in one place, with venues, dates, and reward rules.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 2, marginBottom: 18, paddingHorizontal: 20 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: "rgba(255,255,255,0.34)", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Total</Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>{redemptions.length}</Text>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginTop: 4 }}>{uniqueVenueCount} venues visited</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: "rgba(255,255,255,0.34)", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Tier Rewards</Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>{tierRedemptionCount}</Text>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginTop: 4 }}>{latestRedemption ? `Latest: ${latestRedemption.venue_name}` : "No redemptions yet"}</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 6, gap: 8 }}
          style={{ flexGrow: 0, marginBottom: 10 }}
        >
          {[
            { key: "all" as const, label: "All" },
            { key: "standard" as const, label: "Standard" },
            { key: "tier" as const, label: "Tier" },
          ].map((item) => {
            const active = activeFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setActiveFilter(item.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: active ? YELLOW : "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: active ? YELLOW : BORDER,
                }}
              >
                <Text style={{ color: active ? NAV : "white", fontSize: 12, fontWeight: "800" }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {redemptionGroups.length === 0 ? (
          <View style={{
            marginHorizontal: 20,
            backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 32,
            alignItems: "center", borderWidth: 1, borderColor: BORDER,
          }}>
            <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.15)" />
            <Text style={{ color: "white", fontSize: 15, fontWeight: "700", marginTop: 14, marginBottom: 6 }}>
              No redemptions yet
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
              Visit a HU NOW venue and scan your QR code to start building your history.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(customer)/venues")}
              style={{ backgroundColor: YELLOW, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginTop: 18 }}
            >
              <Text style={{ color: NAV, fontWeight: "800", fontSize: 14 }}>Browse Offers</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {redemptionGroups.map((group) => (
              <View key={group.label}>
                <Text style={{
                  color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "700",
                  letterSpacing: 1.5, textTransform: "uppercase",
                  marginTop: 16, marginBottom: 8,
                }}>
                  {group.label}
                </Text>
                {group.items.map((r, i) => (
                  <View key={`${group.label}-${i}`} style={{
                    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 14,
                    marginBottom: 8, flexDirection: "row", alignItems: "center",
                    borderWidth: 1, borderColor: BORDER,
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
                      {r.tier ? (
                        <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(251,201,0,0.15)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 }}>
                          <Text style={{ color: YELLOW, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>{r.tier} tier reward</Text>
                        </View>
                      ) : null}
                      {(r.limit_count || r.limit_period) ? (
                        <Text style={{ color: "rgba(255,255,255,0.32)", fontSize: 11, marginTop: 4 }}>
                          Rule: {formatOfferRule(r.limit_count, r.limit_period)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ backgroundColor: YELLOW + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="star" size={10} color={YELLOW} />
                      <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "800" }}>+35 pts</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
