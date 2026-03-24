import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Switch, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type Offer = Database["public"]["Tables"]["offers"]["Row"];
type RedemptionType = "one_time" | "unlimited" | "once_per_day" | "once_per_week" | "once_per_month";

const REDEMPTION_LABELS: Record<RedemptionType, string> = {
  one_time: "One-time only",
  unlimited: "Unlimited",
  once_per_day: "Once per day",
  once_per_week: "Once per week",
  once_per_month: "Once per month",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  terms: "",
  redemption_type: "unlimited" as RedemptionType,
  is_active: true,
};

export default function OffersScreen() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadOffers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: biz } = await supabase.from("businesses").select("id").eq("user_id", user.id).single();
    if (!biz) return;
    setBusinessId(biz.id);
    const { data } = await supabase.from("offers").select("*").eq("business_id", biz.id).order("created_at", { ascending: false });
    setOffers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(offer: Offer) {
    setEditing(offer);
    setForm({
      title: offer.title,
      description: offer.description ?? "",
      terms: offer.terms ?? "",
      redemption_type: offer.redemption_type as RedemptionType,
      is_active: offer.is_active,
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !businessId) return;
    setSaving(true);

    if (editing) {
      await supabase.from("offers").update({ ...form }).eq("id", editing.id);
    } else {
      await supabase.from("offers").insert({ ...form, business_id: businessId });
    }

    setSaving(false);
    setModalVisible(false);
    loadOffers();
  }

  async function handleDelete(offer: Offer) {
    Alert.alert("Delete Offer", `Delete "${offer.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await supabase.from("offers").delete().eq("id", offer.id);
          loadOffers();
        },
      },
    ]);
  }

  if (loading) {
    return <View className="flex-1 bg-brand-navy items-center justify-center"><ActivityIndicator color="#FBC900" /></View>;
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-white text-2xl font-bold">Offers</Text>
        <TouchableOpacity className="bg-brand-yellow rounded-xl px-4 py-2" onPress={openNew}>
          <Text className="text-brand-navy font-bold text-sm">+ New Offer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5">
        {offers.length === 0 && (
          <Text className="text-white/40 text-sm text-center mt-8">No offers yet. Create your first one!</Text>
        )}
        {offers.map((offer) => (
          <View key={offer.id} className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-white font-semibold">{offer.title}</Text>
                {offer.description && (
                  <Text className="text-white/50 text-xs mt-1" numberOfLines={2}>{offer.description}</Text>
                )}
                <Text className="text-brand-yellow/70 text-xs mt-2">
                  {REDEMPTION_LABELS[offer.redemption_type as RedemptionType]}
                </Text>
              </View>
              <View className={`ml-3 px-2 py-1 rounded-full ${offer.is_active ? "bg-green-500/20" : "bg-white/10"}`}>
                <Text className={`text-xs font-semibold ${offer.is_active ? "text-green-400" : "text-white/40"}`}>
                  {offer.is_active ? "Active" : "Off"}
                </Text>
              </View>
            </View>
            <View className="flex-row mt-3 gap-2">
              <TouchableOpacity className="flex-1 bg-white/10 rounded-lg py-2 items-center" onPress={() => openEdit(offer)}>
                <Text className="text-white/70 text-xs">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg py-2 items-center" onPress={() => handleDelete(offer)}>
                <Text className="text-red-400 text-xs">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[#1a0a4a] rounded-t-3xl p-6">
            <Text className="text-white font-bold text-lg mb-4">{editing ? "Edit Offer" : "New Offer"}</Text>

            <TextInput
              className="bg-white/10 text-white rounded-xl px-4 py-3 mb-3 border border-white/20"
              placeholder="Offer title"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={form.title}
              onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
            />
            <TextInput
              className="bg-white/10 text-white rounded-xl px-4 py-3 mb-3 border border-white/20"
              placeholder="Description (optional)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              multiline
              numberOfLines={3}
            />
            <TextInput
              className="bg-white/10 text-white rounded-xl px-4 py-3 mb-4 border border-white/20"
              placeholder="Terms & conditions (optional)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={form.terms}
              onChangeText={(t) => setForm((f) => ({ ...f, terms: t }))}
            />

            <Text className="text-white/60 text-xs mb-2">Redemption Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {(Object.keys(REDEMPTION_LABELS) as RedemptionType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`mr-2 px-3 py-2 rounded-xl border ${form.redemption_type === type ? "bg-brand-yellow border-brand-yellow" : "bg-white/10 border-white/20"}`}
                  onPress={() => setForm((f) => ({ ...f, redemption_type: type }))}
                >
                  <Text className={`text-xs font-semibold ${form.redemption_type === type ? "text-brand-navy" : "text-white/60"}`}>
                    {REDEMPTION_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white/70 text-sm">Active</Text>
              <Switch
                value={form.is_active}
                onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                trackColor={{ true: "#FBC900", false: "rgba(255,255,255,0.2)" }}
                thumbColor={form.is_active ? "#0F0032" : "#fff"}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity className="flex-1 bg-white/10 rounded-xl py-4 items-center" onPress={() => setModalVisible(false)}>
                <Text className="text-white/70 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-brand-yellow rounded-xl py-4 items-center" onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#0F0032" /> : <Text className="text-brand-navy font-bold">Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
