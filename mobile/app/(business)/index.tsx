import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export default function BusinessDashboard() {
  const { user } = useAuth();
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [redemptionsThisMonth, setRedemptionsThisMonth] = useState(0);
  const [recentRedemptions, setRecentRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;

      // Get Supabase business record via wp_post_id
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("wp_post_id", user.venue_id)
        .single();

      if (!biz) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { count: total },
        { count: monthly },
        { data: recent },
      ] = await Promise.all([
        supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("business_id", biz.id),
        supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("business_id", biz.id).gte("redeemed_at", monthStart),
        supabase.from("redemptions").select("offer_title, redeemed_at").eq("business_id", biz.id).order("redeemed_at", { ascending: false }).limit(5),
      ]);

      setTotalRedemptions(total ?? 0);
      setRedemptionsThisMonth(monthly ?? 0);
      setRecentRedemptions(recent ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#F5F5F7] items-center justify-center">
        <ActivityIndicator color="#0F0032" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="pt-6 pb-4">
          <Text className="text-[#0F0032]/40 text-sm">Welcome back</Text>
          <Text className="text-[#0F0032] text-2xl font-bold">{user?.display_name}</Text>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-white rounded-2xl p-4"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
          >
            <Text className="text-[#0F0032] text-3xl font-black">{totalRedemptions}</Text>
            <Text className="text-[#0F0032]/40 text-xs mt-1">Total Redemptions</Text>
          </View>
          <View className="flex-1 bg-brand-yellow rounded-2xl p-4"
            style={{ shadowColor: "#FBC900", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            <Text className="text-[#0F0032] text-3xl font-black">{redemptionsThisMonth}</Text>
            <Text className="text-[#0F0032]/60 text-xs mt-1">This Month</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View className="bg-white rounded-2xl p-5 mb-6"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
        >
          <Text className="text-[#0F0032] font-bold mb-3">Quick Actions</Text>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#0F0032]/5 rounded-2xl w-10 h-10 items-center justify-center">
              <Ionicons name="qr-code-outline" size={20} color="#0F0032" />
            </View>
            <View>
              <Text className="text-[#0F0032] font-semibold text-sm">Scan to Redeem</Text>
              <Text className="text-[#0F0032]/40 text-xs">Use the Scan tab to redeem offers</Text>
            </View>
          </View>
        </View>

        {/* Recent redemptions */}
        <Text className="text-[#0F0032] font-bold text-base mb-3">Recent Redemptions</Text>
        {recentRedemptions.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center mb-8"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
          >
            <Text className="text-[#0F0032]/30 text-sm">No redemptions yet</Text>
            <Text className="text-[#0F0032]/20 text-xs mt-1">Scan a customer card to get started</Text>
          </View>
        ) : (
          recentRedemptions.map((r, i) => (
            <View key={i} className="bg-white rounded-2xl p-4 mb-2 flex-row items-center"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
            >
              <View className="bg-brand-yellow/20 rounded-full w-9 h-9 items-center justify-center mr-3">
                <Ionicons name="ticket-outline" size={18} color="#0F0032" />
              </View>
              <View className="flex-1">
                <Text className="text-[#0F0032] font-semibold text-sm">{r.offer_title}</Text>
                <Text className="text-[#0F0032]/40 text-xs">
                  {new Date(r.redeemed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          ))
        )}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
