import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { Router } from "expo-router";
import type { WPUser } from "@/lib/wpAuth";
import { wordpress } from "@/lib/wordpress";

const PUSH_PROMPT_SEEN_KEY = "hunow_push_prompt_seen";
const LAST_REGISTERED_PUSH_TOKEN_KEY = "hunow_last_registered_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId(): string | null {
  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    null;
  return projectId || null;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FBC900",
  });
}

async function shouldAskForPushPermission(userId: number) {
  const stored = await AsyncStorage.getItem(`${PUSH_PROMPT_SEEN_KEY}_${userId}`);
  return stored !== "true";
}

async function markPushPermissionPromptSeen(userId: number) {
  await AsyncStorage.setItem(`${PUSH_PROMPT_SEEN_KEY}_${userId}`, "true");
}

async function registerPushToken(jwt: string, userId: number) {
  const projectId = getProjectId();
  if (!projectId) return false;

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (!expoPushToken) return false;

  const storageKey = `${LAST_REGISTERED_PUSH_TOKEN_KEY}_${userId}`;
  const lastRegistered = await AsyncStorage.getItem(storageKey);
  if (lastRegistered === expoPushToken) {
    return true;
  }

  await wordpress.registerPush(expoPushToken, jwt);
  await AsyncStorage.setItem(storageKey, expoPushToken);
  return true;
}

export async function ensurePushNotificationsForUser(token: string, user: WPUser): Promise<void> {
  if (!Device.isDevice || !token || !user?.user_id) return;

  await ensureAndroidChannel();

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status === "granted") {
    await registerPushToken(token, user.user_id);
    return;
  }

  if (!(await shouldAskForPushPermission(user.user_id))) {
    return;
  }

  await markPushPermissionPromptSeen(user.user_id);

  const proceed = await new Promise<boolean>((resolve) => {
    Alert.alert(
      "Stay in the loop",
      user.role === "business"
        ? "Enable notifications for redemptions, vouchers, and live venue activity."
        : "Enable notifications for vouchers, receipts, tier unlocks, loyalty milestones, and rewards becoming available again.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Enable", onPress: () => resolve(true) },
      ],
    );
  });

  if (!proceed) return;

  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return;

  await registerPushToken(token, user.user_id);
}

export function routeFromNotificationData(data: Record<string, unknown> | null | undefined, router: Router) {
  if (!data) return;

  const screen = typeof data.screen === "string" ? data.screen : "";
  const venueId = typeof data.venue_id === "number" ? data.venue_id : Number(data.venue_id || 0);

  if (screen) {
    router.push(screen as never);
    return;
  }

  const type = typeof data.type === "string" ? data.type : "";

  if (type === "voucher_claimed" || type === "loyalty_reward_earned") {
    router.push("/(customer)/news");
    return;
  }

  if (type === "reward_available_again") {
    if (venueId > 0) {
      router.push(`/(customer)/venue/${venueId}` as never);
    } else {
      router.push("/(customer)/venues");
    }
    return;
  }

  if (type === "tier_unlocked") {
    router.push("/(customer)/profile");
    return;
  }

  if (type === "offer_redeemed_business" || type === "voucher_redeemed_business" || type === "loyalty_reward_claimed_business") {
    router.push("/(business)");
  }
}
