import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AppEntryScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    router.replace(user.role === "business" ? "/(business)" : "/(customer)");
  }, [user, loading, router]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0F0032", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
      <ActivityIndicator color="#FBC900" size="large" />
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 14 }}>
        Loading HU NOW…
      </Text>
    </View>
  );
}
