import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { loadToken } from "@/lib/wpAuth";

export default function AuthLayout() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      // If already has a token, the root layout will handle routing to customer
      const token = await loadToken();
      if (token) return;
      // Check if onboarding has been seen
      const seen = await hasSeenOnboarding();
      if (!seen) {
        router.replace("/(auth)/onboarding");
      }
    }
    check();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
