import "@/lib/polyfills";
import "../global.css";
import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { routeFromNotificationData } from "@/lib/push";

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((part) => Number(part) || 0);
  const bParts = b.split(".").map((part) => Number(part) || 0);
  const max = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function RootNavigator() {
  const { user, appConfig, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const currentVersion = Constants.expoConfig?.version ?? "1.0.0";
  const requiresUpgrade = Boolean(appConfig?.min_supported_app_version) && compareVersions(currentVersion, appConfig?.min_supported_app_version ?? "0.0.0") < 0;

  useEffect(() => {
    if (loading || !segments[0]) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      if (user.role === "business") {
        router.replace("/(business)");
      } else {
        router.replace("/(customer)");
      }
    }
  }, [user, loading, segments, router]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromNotificationData(response.notification.request.content.data as Record<string, unknown>, router);
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        routeFromNotificationData(response.notification.request.content.data as Record<string, unknown>, router);
      })
      .catch(() => {});

    return () => subscription.remove();
  }, [router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0F0032", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#FBC900" size="large" />
      </View>
    );
  }

  if (requiresUpgrade) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0F0032", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <Text style={{ color: "white", fontSize: 24, fontWeight: "900", marginBottom: 10, textAlign: "center" }}>Update Required</Text>
        <Text style={{ color: "rgba(255,255,255,0.64)", fontSize: 15, lineHeight: 22, textAlign: "center" }}>
          This version of HU NOW is no longer supported. Please install the latest build to keep using the app.
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(business)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
