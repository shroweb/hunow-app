import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Redemption = Database["public"]["Tables"]["redemptions"]["Row"] & {
  offers: { title: string } | null;
  businesses: { name: string } | null;
};

export default function MyCardScreen() {
  const [card, setCard] = useState<Card | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: cardData }, { data: redemptionData }] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", user.id).single(),
        supabase.from("cards").select("*").eq("user_id", user.id).single(),
        supabase
          .from("redemptions")
          .select("*, offers(title), businesses(name)")
          .eq("card_id", (await supabase.from("cards").select("id").eq("user_id", user.id).single()).data?.id ?? "")
          .order("redeemed_at", { ascending: false })
          .limit(10),
      ]);

      setUserName(profile?.name ?? "");
      setCard(cardData);
      setRedemptions((redemptionData ?? []) as Redemption[]);
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
        <Text className="text-white text-2xl font-bold mb-6">{userName}</Text>

        {/* Card */}
        <View className="bg-white/10 border border-white/20 rounded-3xl p-6 items-center mb-8">
          <Text className="text-brand-yellow font-bold text-xl mb-1">HU NOW</Text>
          <Text className="text-white/50 text-xs mb-6">Member Card</Text>

          {card ? (
            <View className="bg-white p-4 rounded-2xl">
              <QRCode
                value={card.qr_token}
                size={200}
                color="#0F0032"
                backgroundColor="white"
              />
            </View>
          ) : (
            <Text className="text-white/50 text-sm">No card found</Text>
          )}

          <Text className="text-white/40 text-xs mt-4 font-mono">
            {card?.qr_token.slice(0, 8).toUpperCase()}
          </Text>
        </View>

        {/* Recent Redemptions */}
        <Text className="text-white font-bold text-lg mb-3">Recent Redemptions</Text>
        {redemptions.length === 0 ? (
          <Text className="text-white/40 text-sm pb-8">No offers redeemed yet. Visit a venue to get started!</Text>
        ) : (
          redemptions.map((r) => (
            <View key={r.id} className="bg-white/10 rounded-2xl p-4 mb-3">
              <Text className="text-white font-semibold">{r.offers?.title ?? "Offer"}</Text>
              <Text className="text-white/50 text-xs mt-1">{r.businesses?.name}</Text>
              <Text className="text-brand-yellow text-xs mt-1">
                {new Date(r.redeemed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
