import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      setEmail(user.email ?? "");
      setName(profile?.name ?? "");
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View className="flex-1 bg-brand-navy items-center justify-center">
        <ActivityIndicator color="#FBC900" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy px-5">
      <Text className="text-white text-2xl font-bold mt-6 mb-6">Profile</Text>

      <View className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-4">
        <Text className="text-white/50 text-xs mb-1">Name</Text>
        <Text className="text-white font-semibold">{name}</Text>
      </View>

      <View className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-8">
        <Text className="text-white/50 text-xs mb-1">Email</Text>
        <Text className="text-white font-semibold">{email}</Text>
      </View>

      <TouchableOpacity
        className="bg-red-500/20 border border-red-500/40 rounded-xl py-4 items-center"
        onPress={handleSignOut}
      >
        <Text className="text-red-400 font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
