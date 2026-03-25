import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Link } from "expo-router";
import { requestPasswordReset } from "@/lib/wpAuth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await requestPasswordReset(email.trim());
      setSuccess(result.message);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send reset email.");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F5F7]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-8">
        <View className="bg-white rounded-3xl p-6"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20 }}
        >
          <Text className="text-[#0F0032] text-xl font-bold mb-2">Reset password</Text>
          <Text className="text-[#0F0032]/40 text-sm mb-5">
            Enter your account email and we&apos;ll send you a reset link.
          </Text>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          )}

          {success && (
            <View className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-4">
              <Text className="text-green-700 text-sm">{success}</Text>
            </View>
          )}

          <View className="bg-[#F5F5F7] rounded-2xl px-4 py-4 mb-6 border border-[#E5E5EA]">
            <Text className="text-[#0F0032]/40 text-xs mb-1">Email</Text>
            <TextInput
              className="text-[#0F0032] text-base"
              placeholder="you@example.com"
              placeholderTextColor="rgba(15,0,50,0.25)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <TouchableOpacity
            className="bg-[#0F0032] rounded-2xl py-4 items-center"
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FBC900" />
              : <Text className="text-white font-bold text-base">Send Reset Link</Text>
            }
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="text-[#0F0032]/40 text-sm">Remembered it? </Text>
          <Link href="/(auth)/login">
            <Text className="text-[#0F0032] text-sm font-bold">Back to sign in</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
