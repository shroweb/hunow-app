import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hunow_onboarding_complete";

export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEY);
  return !!val;
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
