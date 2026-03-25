import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { fetchBusinessDashboard, type BusinessDashboardResponse } from "@/lib/wpAuth";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

export default function BusinessDashboard() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [dashboard, setDashboard] = useState<BusinessDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!token) return;
      const data = await fetchBusinessDashboard(token).catch(() => null);
      setDashboard(data);
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  const stats = dashboard?.stats;
  const recent = stats?.recent_scans ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Business Dashboard</Text>
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>{dashboard?.venue_name ?? user?.display_name ?? "Your venue"}</Text>
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
