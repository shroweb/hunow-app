import { Tabs } from "expo-router";
import { View, Text } from "react-native";

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <Text className={`text-xs mt-1 ${active ? "text-brand-yellow" : "text-white/40"}`}>
      {label}
    </Text>
  );
}

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0F0032",
          borderTopColor: "rgba(255,255,255,0.1)",
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#FBC900",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "My Card" }} />
      <Tabs.Screen name="venues" options={{ title: "Venues" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
