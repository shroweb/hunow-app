import { View, ActivityIndicator, Text } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AppEntryScreen() {
  const { user, loading } = useAuth();

  if (!loading) {
    if (!user) {
      return <Redirect href="/(auth)/login" />;
    }

    return <Redirect href={user.role === "business" ? "/(business)" : "/(customer)"} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0F0032", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
      <ActivityIndicator color="#FBC900" size="large" />
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 14 }}>
        Loading HU NOW…
      </Text>
    </View>
  );
}
