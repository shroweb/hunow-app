import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { WPUser } from "@/lib/wpAuth";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

export function BusinessSetupGate({
  user,
  title = "Venue setup needed",
}: {
  user: WPUser | null;
  title?: string;
}) {
  const router = useRouter();
  const WP_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace(/\/wp\/v2$/, "");
  const PORTAL_URL = `${WP_BASE.replace(/\/wp-json$/, "")}/my-account/`;

  return (
    <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Ionicons name="construct-outline" size={28} color={YELLOW} />
      </View>
      <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 8, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 24 }}>
        {user?.setup_message ?? "This business account needs to be linked and checked in WordPress before the business tools will work."}
      </Text>
      <View style={{ width: "100%", gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.push("/(business)/profile")}
          style={{ backgroundColor: YELLOW, borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
        >
          <Text style={{ color: NAV, fontWeight: "900", fontSize: 15 }}>Review Setup Status</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL(PORTAL_URL)}
          style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>Open Business Portal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
