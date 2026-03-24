import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

type Stats = {
  totalOffers: number;
  activeOffers: number;
  totalRedemptions: number;
  redemptionsThisMonth: number;
};

export default function BusinessDashboard() {
  const [businessName, setBusinessName] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!business) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { count: totalOffers },
        { count: activeOffers },
        { count: totalRedemptions },
        { count: redemptionsThisMonth },
        { data: recent },
      ] = await Promise.all([
        supabase.from("offers").select("*", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("offers").select("*", { count: "exact", head: true }).eq("business_id", business.id).eq("is_active", true),
        supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("business_id", business.id).gte("redeemed_at", monthStart),
        supabase.from("redemptions").select("*, offers(title), cards(user_id), profiles!inner(name)").eq("business_id", business.id).order("redeemed_at", { ascending: false }).limit(5),
      ]);

      setBusinessName(profile?.name ?? "");
      setStats({ totalOffers: totalOffers ?? 0, activeOffers: activeOffers ?? 0, totalRedemptions: totalRedemptions ?? 0, redemptionsThisMonth: redemptionsThisMonth ?? 0 });
      setRecentRedemptions(recent ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 bg-brand-navy items-center justify-center">
        <ActivityIndicator color="#FBC900" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <ScrollView className="flex-1 px-5">
        <Text className="text-white/60 text-sm mt-6">Welcome back</Text>
        <Text className="text-white text-2xl font-bold mb-6">{businessName}</Text>

        {stats && (
          <View className="flex-row flex-wrap gap-3 mb-6">
            {[
              { label: "Total Offers", value: stats.totalOffers },
              { label: "Active Offers", value: stats.activeOffers },
              { label: "All Redemptions", value: stats.totalRedemptions },
              { label: "This Month", value: stats.redemptionsThisMonth },
            ].map((s) => (
              <View key={s.label} className="bg-white/10 border border-white/20 rounded-2xl p-4 flex-1 min-w-[140px]">
                <Text className="text-brand-yellow text-3xl font-bold">{s.value}</Text>
                <Text className="text-white/50 text-xs mt-1">{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        <Text className="text-white font-bold text-lg mb-3">Recent Redemptions</Text>
        {recentRedemptions.length === 0 ? (
          <Text className="text-white/40 text-sm pb-8">No redemptions yet</Text>
        ) : (
          recentRedemptions.map((r, i) => (
            <View key={i} className="bg-white/10 rounded-2xl p-4 mb-3">
              <Text className="text-white font-semibold">{r.offers?.title}</Text>
              <Text className="text-white/50 text-xs mt-1">{r.profiles?.name}</Text>
              <Text className="text-brand-yellow text-xs mt-1">
                {new Date(r.redeemed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
