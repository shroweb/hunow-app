import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { updateNotificationPreferences, type WPNotificationPreferences } from "@/lib/wpAuth";
import { wordpress, extractOffers, type WPEat } from "@/lib/wordpress";

function NotificationToggleRow({
  label,
  description,
  value,
  onPress,
}: {
  label: string;
  description: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="bg-[#F5F5F7] rounded-2xl p-4 border border-[#0F0032]/10 mb-3"
      onPress={onPress}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[#0F0032] font-semibold mb-1">{label}</Text>
          <Text className="text-[#0F0032]/55 text-xs leading-5">{description}</Text>
        </View>
        <View className={`rounded-full px-3 py-1.5 ${value ? "bg-brand-yellow" : "bg-[#0F0032]/10"}`}>
          <Text className={`text-xs font-bold ${value ? "text-[#0F0032]" : "text-[#0F0032]/65"}`}>{value ? "On" : "Off"}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BusinessProfileScreen() {
  const { user, token, signOut, refreshUser } = useAuth();
  const [venue, setVenue] = useState<WPEat | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const WP_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace(/\/wp\/v2$/, "");
  const PORTAL_URL = `${WP_BASE.replace(/\/wp-json$/, "")}/my-account/`;

  useEffect(() => {
    async function loadVenue() {
      if (!user?.venue_id) return;
      setLoadingVenue(true);
      try {
        const data = await wordpress.getEatById(user.venue_id);
        setVenue(data);
      } catch {
        setVenue(null);
      } finally {
        setLoadingVenue(false);
      }
    }
    loadVenue();
  }, [user?.venue_id]);

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  async function openUrl(url: string) {
    await Linking.openURL(url);
  }

  if (!user) return null;

  const standardOffers = venue ? extractOffers(venue) : [];
  const tierOfferCount = venue?.tier_offers?.length ?? 0;
  const setupReady = user.setup_status === "ready";
  const notificationPreferences: WPNotificationPreferences = user.notification_preferences ?? {
    member: {
      receipts: true,
      vouchers: true,
      tier_updates: true,
      reward_reminders: true,
      loyalty_milestones: true,
    },
    business: {
      offer_redeems: true,
      voucher_redeems: true,
    },
  };

  async function handleToggleBusinessNotification<K extends keyof WPNotificationPreferences["business"]>(key: K) {
    if (!token) return;
    setSavingNotifications(true);
    try {
      const updated: WPNotificationPreferences = {
        ...notificationPreferences,
        business: {
          ...notificationPreferences.business,
          [key]: !notificationPreferences.business[key],
        },
      };
      await updateNotificationPreferences(updated, token);
      await refreshUser();
    } catch (e: unknown) {
      Alert.alert("Couldn’t update notifications", e instanceof Error ? e.message : "Please try again.");
    }
    setSavingNotifications(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <Text className="text-[#0F0032] text-2xl font-bold mt-6 mb-6">Business Profile</Text>

        {/* Avatar */}
        <View className="items-center mb-6">
          <View className="bg-[#0F0032] rounded-full w-20 h-20 items-center justify-center mb-3"
            style={{ shadowColor: "#0F0032", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}
          >
            <Text className="text-brand-yellow text-2xl font-bold">
              {user.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-[#0F0032] text-xl font-bold">{user.display_name}</Text>
          <View className="bg-[#0F0032]/5 rounded-full px-3 py-1 mt-1">
            <Text className="text-[#0F0032]/50 text-xs font-semibold uppercase tracking-wide">Business Account</Text>
          </View>
        </View>

        {/* Account details */}
        <View className="bg-white rounded-2xl overflow-hidden mb-4"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
        >
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Business Name</Text>
            <Text className="text-[#0F0032] font-semibold">{user.display_name}</Text>
          </View>
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Email</Text>
            <Text className="text-[#0F0032] font-semibold">{user.email}</Text>
          </View>
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">WordPress Venue Post ID</Text>
            <Text className="text-[#0F0032] font-semibold">
              {user.venue_id ? String(user.venue_id) : "Not linked"}
            </Text>
            <Text className="text-[#0F0032]/30 text-xs mt-1">
              {user.venue_id
                ? "Your account is linked to your hunow.co.uk listing."
                : "Contact HU NOW admin to link your venue listing."}
            </Text>
          </View>
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Linked Venue</Text>
            <Text className="text-[#0F0032] font-semibold">{user.venue_name || "Not linked"}</Text>
          </View>
          <View className="px-5 py-4">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Subscription Tier</Text>
            <Text className="text-[#0F0032] font-semibold" style={{ textTransform: "capitalize" }}>{user.subscription_tier ?? "basic"}</Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl overflow-hidden mb-4"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
        >
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Business Setup Status</Text>
            <Text className="text-[#0F0032] font-semibold">
              {!user.venue_id ? "Needs linking" : loadingVenue ? "Checking venue…" : setupReady ? "Linked and ready" : "Needs attention"}
            </Text>
            <Text className="text-[#0F0032]/35 text-xs mt-1">
              {user.setup_message
                ? user.setup_message
                : !user.venue_id
                  ? "This account cannot redeem or manage offers until it is linked to a WordPress venue."
                  : venue
                    ? `Connected to ${venue.title.rendered}.`
                    : "The stored venue ID exists on your account, but the listing could not be loaded right now."}
            </Text>
          </View>
          <View className="px-5 py-4 border-b border-[#F5F5F7]">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Live Standard Offers</Text>
            <Text className="text-[#0F0032] font-semibold">{standardOffers.length}</Text>
          </View>
          <View className="px-5 py-4">
            <Text className="text-[#0F0032]/40 text-xs mb-0.5">Live Tier Offers</Text>
            <Text className="text-[#0F0032] font-semibold">{tierOfferCount}</Text>
          </View>
        </View>

        {/* Info banner if no venue linked */}
        {!setupReady && (
          <View className="bg-brand-yellow/15 border border-brand-yellow/30 rounded-2xl p-4 mb-4 flex-row items-start gap-3">
            <Ionicons name="information-circle-outline" size={20} color="#0F0032" />
            <View className="flex-1">
              <Text className="text-[#0F0032] font-semibold text-sm mb-1">Setup incomplete</Text>
              <Text className="text-[#0F0032]/60 text-xs">
                {user.setup_message ?? "Your account needs to be linked to your WordPress venue post before you can redeem offers. Contact the HU NOW team."}
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            className="flex-1 bg-[#0F0032] rounded-2xl py-4 items-center"
            onPress={() => openUrl(PORTAL_URL)}
          >
            <Text className="text-brand-yellow font-semibold">Open Portal</Text>
          </TouchableOpacity>
          {venue && (
            <TouchableOpacity
              className="flex-1 bg-white border border-[#0F0032]/10 rounded-2xl py-4 items-center"
              onPress={() => openUrl(`${WP_BASE.replace(/\/wp-json$/, "")}/eat/${venue.slug}/`)}
            >
              <Text className="text-[#0F0032] font-semibold">View Venue</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
        >
          <Text className="text-[#0F0032] font-semibold mb-2">How management works now</Text>
          <Text className="text-[#0F0032]/60 text-xs leading-5">
            The mobile business app now handles live scanning, redemptions, analytics, and in-app offer editing. The HU NOW web portal is still available for account setup and deeper WordPress-side management.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
        >
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-[#0F0032] font-semibold text-base mb-1">Notifications</Text>
              <Text className="text-[#0F0032]/55 text-xs leading-5">
                Control the business alerts you receive for live venue activity.
              </Text>
            </View>
            <View className={`rounded-full px-3 py-1.5 ${user.has_push_token ? "bg-brand-yellow/20" : "bg-[#0F0032]/8"}`}>
              <Text className={`text-xs font-bold ${user.has_push_token ? "text-[#0F0032]" : "text-[#0F0032]/55"}`}>
                {user.has_push_token ? `${user.push_token_count ?? 1} device` : "Push off"}
              </Text>
            </View>
          </View>

          <NotificationToggleRow
            label="Offer redeems"
            description="Alerts whenever one of your live offers is redeemed."
            value={notificationPreferences.business.offer_redeems}
            onPress={() => handleToggleBusinessNotification("offer_redeems")}
          />
          <NotificationToggleRow
            label="Voucher redeems"
            description="Alerts whenever one of your venue vouchers is redeemed or loyalty rewards are issued."
            value={notificationPreferences.business.voucher_redeems}
            onPress={() => handleToggleBusinessNotification("voucher_redeems")}
          />

          {savingNotifications ? <ActivityIndicator color="#0F0032" style={{ marginTop: 8 }} /> : null}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          className="bg-white border border-red-100 rounded-2xl py-4 items-center mb-8"
          onPress={handleSignOut}
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
        >
          <Text className="text-red-500 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
