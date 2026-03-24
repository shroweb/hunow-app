import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Share, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Redemption = Database["public"]["Tables"]["redemptions"]["Row"] & {
  offers: { title: string } | null;
  businesses: { name: string } | null;
};

function memberNumber(token: string): string {
  return "HUNOW-" + token.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function MyCardScreen() {
  const [card, setCard] = useState<Card | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      const { data: cardData } = await supabase.from("cards").select("*").eq("user_id", user.id).single();

      if (cardData) {
        const { data: redemptionData } = await supabase
          .from("redemptions")
          .select("*, offers(title), businesses(name)")
          .eq("card_id", cardData.id)
          .order("redeemed_at", { ascending: false })
          .limit(10);
        setRedemptions((redemptionData ?? []) as Redemption[]);
      }

      setUserName(profile?.name ?? "");
      setCard(cardData);
      setLoading(false);
    }
    load();
  }, []);

  async function handleShare() {
    if (!card) return;
    await Share.share({ message: `My HU NOW member card: ${memberNumber(card.qr_token)}` });
  }

  if (loading) {
    return (
      <View className="flex-1 bg-[#F5F5F7] items-center justify-center">
        <ActivityIndicator color="#0F0032" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <Text className="text-[#0F0032] text-sm font-medium mb-1 mt-2 opacity-50">My Card</Text>
        <Text className="text-[#0F0032] text-2xl font-bold mb-6">{userName}</Text>

        {card ? (
          <View
            style={{
              borderRadius: 24,
              overflow: "hidden",
              shadowColor: "#0F0032",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.18,
              shadowRadius: 24,
              elevation: 12,
              marginBottom: 16,
            }}
          >
            {/* Yellow Header */}
            <View className="bg-brand-yellow px-6 pt-5 pb-4">
              <View className="flex-row items-start justify-between mb-4">
                <View>
                  <Text className="text-[#0F0032]/50 text-xs font-semibold uppercase tracking-widest mb-1">
                    Member Number
                  </Text>
                  <Text className="text-[#0F0032] text-lg font-bold tracking-wide">
                    {memberNumber(card.qr_token)}
                  </Text>
                </View>
                <View className="bg-[#0F0032] rounded-full px-3 py-1 mt-1">
                  <Text className="text-brand-yellow text-xs font-bold tracking-widest">MEMBER</Text>
                </View>
              </View>
              <Text className="text-[#0F0032]/50 text-xs font-semibold uppercase tracking-widest mb-0.5">
                Member Since
              </Text>
              <Text className="text-[#0F0032] font-semibold text-sm">
                {memberSince(card.created_at)}
              </Text>
            </View>

            {/* White QR Section */}
            <View className="bg-white items-center px-6 pt-8 pb-6">
              <QRCode value={card.qr_token} size={200} color="#0F0032" backgroundColor="white" />
              <Text className="text-[#0F0032]/40 text-xs mt-4 tracking-wide">Scan to verify membership</Text>
            </View>

            {/* Navy Footer */}
            <View className="bg-[#0F0032] px-6 py-4 flex-row items-center justify-between">
              <View>
                <Text className="text-white text-base font-bold">{userName}</Text>
                <Text className="text-brand-yellow text-xs mt-0.5">hunow.co.uk</Text>
              </View>
              <Text className="text-white text-2xl font-black tracking-tight">
                HU <Text className="text-brand-yellow">NOW</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View className="bg-white rounded-3xl p-8 items-center mb-4">
            <Text className="text-[#0F0032]/40 text-sm text-center">No card found. Please contact support.</Text>
          </View>
        )}

        <TouchableOpacity
          className="bg-brand-yellow rounded-2xl py-4 flex-row items-center justify-center mb-8"
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={18} color="#0F0032" />
          <Text className="text-[#0F0032] font-bold ml-2">Share My Card</Text>
        </TouchableOpacity>

        <Text className="text-[#0F0032] font-bold text-lg mb-3">Recent Redemptions</Text>
        {redemptions.length === 0 ? (
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-[#0F0032]/40 text-sm text-center">
              No offers redeemed yet.{"\n"}Visit a venue to get started!
            </Text>
          </View>
        ) : (
          redemptions.map((r) => (
            <View key={r.id} className="bg-white rounded-2xl p-4 mb-3 flex-row items-center">
              <View className="bg-brand-yellow/20 rounded-xl w-10 h-10 items-center justify-center mr-3">
                <Ionicons name="ticket-outline" size={18} color="#0F0032" />
              </View>
              <View className="flex-1">
                <Text className="text-[#0F0032] font-semibold text-sm">{r.offers?.title ?? "Offer"}</Text>
                <Text className="text-[#0F0032]/50 text-xs mt-0.5">{r.businesses?.name}</Text>
              </View>
              <Text className="text-[#0F0032]/40 text-xs">
                {new Date(r.redeemed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
