import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { requestPasswordReset, updateEmail, type WPChallenge } from "@/lib/wpAuth";
import { TIER_META } from "@/lib/tierMeta";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function memberNumber(token: string): string {
  return "HUNOW-" + token.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function getTier(points: number) {
  if (points >= 1400) return "gold";
  if (points >= 600) return "silver";
  if (points >= 200) return "bronze";
  return "standard";
}

function getTierKey(tier?: string | null, points = 0) {
  const normalized = tier?.toLowerCase();
  if (normalized && normalized in TIER_META) {
    return normalized as keyof typeof TIER_META;
  }
  return getTier(points) as keyof typeof TIER_META;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(value, 1)) * 100}%`, height: "100%", backgroundColor: YELLOW, borderRadius: 999 }} />
    </View>
  );
}

function ChallengeCard({ item }: { item: WPChallenge }) {
  const progress = item.target > 0 ? Math.min(item.progress / item.target, 1) : 0;
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.07)",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: "white", fontSize: 15, fontWeight: "800", marginBottom: 4 }}>{item.title}</Text>
          <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 13, lineHeight: 18 }}>{item.description}</Text>
        </View>
        <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "900" }}>{item.reward}</Text>
        </View>
      </View>
      <Text style={{ color: "rgba(255,255,255,0.56)", fontSize: 12, fontWeight: "700", marginBottom: 8 }}>
        {item.progress} / {item.target}
      </Text>
      <ProgressBar value={progress} />
    </View>
  );
}

export default function ProfileScreen() {
  const { user, token, signOut, refreshUser } = useAuth();
  const [nextEmail, setNextEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  if (!user) return null;
  const currentUser = user;

  const tierKey = getTierKey(currentUser.tier, currentUser.points ?? 0);
  const tierMeta = TIER_META[tierKey];
  const memberSince = currentUser.card_created
    ? new Date(currentUser.card_created).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "—";
  const streakText = user.today_checked_in
    ? `Checked in today • ${user.login_streak ?? 0} day streak`
    : `${user.login_streak ?? 0} day streak ready to continue`;
  const challengeList = useMemo(() => currentUser.challenges ?? [], [currentUser.challenges]);

  async function handleUpdateEmail() {
    if (!token) return;
    if (!nextEmail.trim() || !currentPassword) {
      Alert.alert("Missing details", "Enter your new email and current password.");
      return;
    }
    setSavingEmail(true);
    try {
      await updateEmail(nextEmail.trim(), currentPassword, token);
      await refreshUser();
      setCurrentPassword("");
      Alert.alert("Email updated", "Your account email has been changed.");
    } catch (e: unknown) {
      Alert.alert("Couldn’t update email", e instanceof Error ? e.message : "Please try again.");
    }
    setSavingEmail(false);
  }

  async function handlePasswordReset() {
    setSendingReset(true);
    try {
      const result = await requestPasswordReset(currentUser.email);
      Alert.alert("Reset email sent", result.message);
    } catch (e: unknown) {
      Alert.alert("Couldn’t send reset email", e instanceof Error ? e.message : "Please try again.");
    }
    setSendingReset(false);
  }

  async function handleShareReferral() {
    const code = currentUser.referral_code ?? "";
    if (!code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Join HU NOW with my invite code ${code} and unlock city rewards across Hull.`,
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900", marginBottom: 18, letterSpacing: -0.5 }}>Profile</Text>

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.07)",
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: YELLOW, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
              <Text style={{ color: NAV, fontSize: 28, fontWeight: "900" }}>{user.display_name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "white", fontSize: 24, fontWeight: "900", marginBottom: 3 }}>{user.display_name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{memberNumber(user.card_token)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name={tierMeta.icon} size={14} color={tierMeta.color} />
                <Text style={{ color: tierMeta.color, fontSize: 12, fontWeight: "800", textTransform: "capitalize" }}>{tierMeta.label} member</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: YELLOW, borderRadius: 18, padding: 16 }}>
              <Text style={{ color: "rgba(15,0,50,0.55)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Points</Text>
              <Text style={{ color: NAV, fontSize: 32, fontWeight: "900" }}>{currentUser.points}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Check-in streak</Text>
              <Text style={{ color: "white", fontSize: 28, fontWeight: "900", marginBottom: 2 }}>{user.login_streak ?? 0}</Text>
              <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 11 }}>{streakText}</Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.07)",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>Invite friends</Text>
            <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "900" }}>{user.referral_count ?? 0} joined</Text>
            </View>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.46)", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
            Share your invite code. When a friend joins with it, both of you get a HU NOW points boost.
          </Text>
          <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>Your invite code</Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900", letterSpacing: 1.2 }}>{user.referral_code ?? "HUNOW"}</Text>
          </View>
          <TouchableOpacity
            onPress={handleShareReferral}
            style={{ backgroundColor: YELLOW, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: NAV, fontWeight: "900" }}>Share Invite</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.07)",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 12 }}>Account</Text>
          <View style={{ gap: 12 }}>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginBottom: 3 }}>Email</Text>
              <Text style={{ color: "white", fontWeight: "700" }}>{user.email}</Text>
            </View>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginBottom: 3 }}>Member since</Text>
              <Text style={{ color: "white", fontWeight: "700" }}>{memberSince}</Text>
            </View>
          </View>
        </View>

        {challengeList.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "white", fontWeight: "800", fontSize: 18, marginBottom: 10 }}>Challenges</Text>
            {challengeList.map((item) => (
              <ChallengeCard key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.07)",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 16, marginBottom: 12 }}>Account security</Text>

          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 6 }}>New email</Text>
          <TextInput
            value={nextEmail}
            onChangeText={setNextEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="new@email.com"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "white",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              marginBottom: 12,
            }}
          />

          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 6 }}>Current password</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Enter current password"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "white",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              marginBottom: 12,
            }}
          />

          <TouchableOpacity
            onPress={handleUpdateEmail}
            disabled={savingEmail}
            style={{ backgroundColor: YELLOW, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 }}
          >
            {savingEmail ? <ActivityIndicator color={NAV} /> : <Text style={{ color: NAV, fontWeight: "800" }}>Update Email</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePasswordReset}
            disabled={sendingReset}
            style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
          >
            {sendingReset ? <ActivityIndicator color={YELLOW} /> : <Text style={{ color: "white", fontWeight: "700" }}>Send Password Reset Email</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={signOut}
          style={{
            borderWidth: 1,
            borderColor: "rgba(255,80,80,0.3)",
            backgroundColor: "rgba(255,80,80,0.08)",
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Text style={{ color: "#ff6b6b", fontWeight: "700" }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
