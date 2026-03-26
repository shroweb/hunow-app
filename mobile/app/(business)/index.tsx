import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { fetchBusinessDashboard, type BusinessDashboardResponse } from "@/lib/wpAuth";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const DASHBOARD_REFRESH_KEY = "hunow_business_dashboard_refresh";

export default function BusinessDashboard() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [dashboard, setDashboard] = useState<BusinessDashboardResponse | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (!token) return;
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    const data = await fetchBusinessDashboard(token, range).catch(() => null);
    setDashboard(data);
    setLoading(false);
    setRefreshing(false);
  }, [token, range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    let lastSeen: string | null = null;
    AsyncStorage.getItem(DASHBOARD_REFRESH_KEY).then((value) => {
      lastSeen = value;
    });
    const interval = setInterval(async () => {
      if (!mounted || !token) return;
      const next = await AsyncStorage.getItem(DASHBOARD_REFRESH_KEY);
      if (next && next !== lastSeen) {
        lastSeen = next;
        load("refresh");
      }
    }, 2500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [load, token]);

  useFocusEffect(useCallback(() => {
    load("refresh");
  }, [load]));

  function onRefresh() {
    load("refresh");
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  const stats = dashboard?.stats;
  const recent = stats?.recent_scans ?? [];
  const topOffers = stats?.top_offers ?? [];
  const tierBreakdown = stats?.tier_breakdown ?? { bronze: 0, silver: 0, gold: 0 };
  const dayCounts = stats?.day_counts ?? {};
  const busiestCount = Math.max(...Object.values(dayCounts).map((value) => Number(value)), 0);
  const repeatRate = (stats?.unique_members ?? 0) > 0 ? Math.round(((stats?.repeat_members ?? 0) / (stats?.unique_members ?? 1)) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
      >
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Business Dashboard</Text>
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>{dashboard?.venue_name ?? user?.display_name ?? "Your venue"}</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {[
            { value: "7d", label: "7 Days" },
            { value: "30d", label: "30 Days" },
            { value: "90d", label: "90 Days" },
            { value: "all", label: "All Time" },
          ].map((item) => {
            const active = range === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => setRange(item.value as typeof range)}
                style={{ backgroundColor: active ? YELLOW : "rgba(255,255,255,0.07)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: active ? YELLOW : "rgba(255,255,255,0.08)" }}
              >
                <Text style={{ color: active ? NAV : "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "800" }}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: YELLOW, borderRadius: 20, padding: 18 }}>
            <Text style={{ color: "rgba(15,0,50,0.6)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>This Month</Text>
            <Text style={{ color: NAV, fontSize: 32, fontWeight: "900" }}>{stats?.monthly_scans ?? 0}</Text>
            <Text style={{ color: "rgba(15,0,50,0.55)", fontSize: 12, marginTop: 4 }}>QR redemptions</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Total</Text>
            <Text style={{ color: "white", fontSize: 32, fontWeight: "900" }}>{stats?.total_scans ?? 0}</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>All-time scans</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Today</Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>{stats?.today_scans ?? 0}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Last 7 Days</Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>{stats?.weekly_scans ?? 0}</Text>
          </View>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Most Active Day</Text>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "800", marginBottom: 4 }}>{stats?.most_active_day ?? "N/A"}</Text>
          <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13 }}>Your busiest redemption day right now.</Text>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Activity Pattern</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 108 }}>
            {Object.entries(dayCounts).map(([day, value]) => {
              const count = Number(value);
              const height = busiestCount > 0 ? Math.max(14, Math.round((count / busiestCount) * 76)) : 14;
              return (
                <View key={day} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ width: "100%", maxWidth: 24, height, borderRadius: 999, backgroundColor: count > 0 ? YELLOW : "rgba(255,255,255,0.12)", marginBottom: 8 }} />
                  <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 10, fontWeight: "700" }}>{day.slice(0, 3)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Members</Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>{stats?.unique_members ?? 0}</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{stats?.repeat_members ?? 0} repeat customers</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Reward Mix</Text>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>{stats?.standard_redemptions ?? 0} / {stats?.tier_redemptions ?? 0}</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>Standard vs tier</Text>
          </View>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Customer Story</Text>
          <Text style={{ color: "white", fontSize: 16, lineHeight: 22 }}>
            {stats?.repeat_members
              ? `${stats.repeat_members} repeat members make up ${repeatRate}% of your active customer base in this range.`
              : "No repeat-member pattern yet in this range. Keep an eye on the next few redemptions."}
          </Text>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Tier Breakdown</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Bronze", value: tierBreakdown.bronze, colour: "#CD7F32" },
              { label: "Silver", value: tierBreakdown.silver, colour: "#C0C0C0" },
              { label: "Gold", value: tierBreakdown.gold, colour: YELLOW },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: item.colour, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 6 }}>{item.label}</Text>
                <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Top Offers</Text>
          {topOffers.length === 0 ? (
            <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13 }}>No offer data yet.</Text>
          ) : topOffers.map((offer, index) => (
            <View key={`${offer.offer_title}-${index}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: index === topOffers.length - 1 ? 0 : 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "white", fontSize: 14, fontWeight: "700", flex: 1, paddingRight: 12 }}>{offer.offer_title}</Text>
              <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "800" }}>{offer.count}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(business)/scan")}
          style={{ backgroundColor: "white", borderRadius: 20, padding: 18, marginBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="qr-code-outline" size={20} color={NAV} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: NAV, fontSize: 16, fontWeight: "800", marginBottom: 2 }}>Start scanning</Text>
              <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 13 }}>Redeem rewards and see member status live.</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={NAV} />
        </TouchableOpacity>

        <Text style={{ color: "white", fontWeight: "800", fontSize: 17, marginBottom: 10 }}>Recent Scans</Text>
        {recent.length === 0 ? (
          <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
            <Ionicons name="radio-outline" size={34} color="rgba(255,255,255,0.2)" />
            <Text style={{ color: "white", fontWeight: "700", marginTop: 12, marginBottom: 4 }}>No scans yet</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>Your latest reward scans will show up here once staff start redeeming offers.</Text>
          </View>
        ) : (
          recent.map((item, index) => (
            <View key={`${item.timestamp}-${index}`} style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="ticket-outline" size={18} color={YELLOW} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>{item.offer_title || "Reward scan"}</Text>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, marginTop: 2 }}>
                  {item.member_email || "Member"} · {item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Unknown time"}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
