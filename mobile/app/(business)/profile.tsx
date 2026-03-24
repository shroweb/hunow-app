import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

export default function BusinessProfileScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [wpPostId, setWpPostId] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: biz }] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", user.id).single(),
        supabase.from("businesses").select("id, wp_post_id").eq("user_id", user.id).single(),
      ]);
      setEmail(user.email ?? "");
      setName(profile?.name ?? "");
      setBusinessId(biz?.id ?? null);
      setWpPostId(String(biz?.wp_post_id ?? ""));
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!businessId) return;
    setSaving(true);
    await supabase.from("businesses").update({ wp_post_id: wpPostId ? parseInt(wpPostId) : null }).eq("id", businessId);
    Alert.alert("Saved", "Profile updated.");
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <View className="flex-1 bg-brand-navy items-center justify-center"><ActivityIndicator color="#FBC900" /></View>;
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy px-5">
      <Text className="text-white text-2xl font-bold mt-6 mb-6">Business Profile</Text>

      <View className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-4">
        <Text className="text-white/50 text-xs mb-1">Business Name</Text>
        <Text className="text-white font-semibold">{name}</Text>
      </View>

      <View className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-4">
        <Text className="text-white/50 text-xs mb-1">Email</Text>
        <Text className="text-white font-semibold">{email}</Text>
      </View>

      <View className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-6">
        <Text className="text-white/50 text-xs mb-2">WordPress Venue Post ID</Text>
        <TextInput
          className="text-white text-base"
          placeholder="e.g. 42"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={wpPostId}
          onChangeText={setWpPostId}
          keyboardType="number-pad"
        />
        <Text className="text-white/30 text-xs mt-2">Links this account to your listing on hunow.co.uk</Text>
      </View>

      <TouchableOpacity className="bg-brand-yellow rounded-xl py-4 items-center mb-4" onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F0032" /> : <Text className="text-brand-navy font-bold">Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity className="bg-red-500/20 border border-red-500/40 rounded-xl py-4 items-center" onPress={handleSignOut}>
        <Text className="text-red-400 font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
