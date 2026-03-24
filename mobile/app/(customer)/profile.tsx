import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

function memberNumber(token: string): string {
  return "HUNOW-" + token.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <Text className="text-[#0F0032] text-2xl font-bold mt-6 mb-6">Profile</Text>

        {/* Avatar + name */}
        <View className="items-center mb-6">
          <View className="bg-[#0F0032] rounded-full w-20 h-20 items-center justify-center mb-3"
            style={{ shadowColor: "#0F0032", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}
          >
            <Text className="text-brand-yellow text-2xl font-bold">
              {user.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-[#0F0032] text-xl font-bold">{user.display_name}</Text>
          <Text className="text-[#0F0032]/40 text-sm">{memberNumber(user.card_token)}</Text>
        </View>

        {/* Points badge */}
        <View className="bg-brand-yellow rounded-2xl p-4 mb-4 flex-row items-center justify-between"
          style={{ shadowColor: "#FBC900", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }}
        >
          <View>
            <Text className="text-[#0F0032]/60 text-xs font-semibold uppercase tracking-wide">HU NOW Points</Text>
            <Text className="text-[#0F0032] text-3xl font-black">{user.points}</Text>
          </View>
          <View className="bg-[#0F0032]/10 rounded-full w-12 h-12 items-center justify-center">
            <Ionicons name="star" size={22} color="#0F0032" />
          </View>
        </View>

        {/* Account details */}
        <View className="bg-white rounded-2xl overflow-hidden mb-4"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
        >
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Name</Text>
            <Text className="text-[#0F0032] font-semibold">{user.display_name}</Text>
          </View>
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Email</Text>
            <Text className="text-[#0F0032] font-semibold">{user.email}</Text>
          </View>
          <View className="px-5 py-4">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Member since</Text>
            <Text className="text-[#0F0032] font-semibold">
              {user.card_created
                ? new Date(user.card_created).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
                : "—"}
            </Text>
          </View>
        </View>

        {/* Recent redemptions */}
        {user.redemptions.length > 0 && (
          <View className="mb-4">
            <Text className="text-[#0F0032] font-bold text-base mb-3">Recent Redemptions</Text>
            {user.redemptions.map((r, i) => (
              <View key={i} className="bg-white rounded-2xl p-4 mb-2 flex-row items-center"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
              >
                <View className="bg-brand-yellow/20 rounded-full w-9 h-9 items-center justify-center mr-3">
                  <Ionicons name="ticket-outline" size={18} color="#0F0032" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#0F0032] font-semibold text-sm">{r.offer_title}</Text>
                  <Text className="text-[#0F0032]/40 text-xs">{r.venue_name}</Text>
                </View>
                <Text className="text-[#0F0032]/30 text-xs">
                  {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity
          className="bg-white border border-red-100 rounded-2xl py-4 items-center mb-8"
          onPress={signOut}
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
        >
          <Text className="text-red-500 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
