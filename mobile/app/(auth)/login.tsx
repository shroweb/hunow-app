import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed. Please try again.");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F5F7]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo / brand */}
        <View className="items-center mb-10">
          <View className="bg-[#0F0032] rounded-3xl w-20 h-20 items-center justify-center mb-4"
            style={{ shadowColor: "#0F0032", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 }}
          >
            <Text className="text-brand-yellow text-2xl font-black">HN</Text>
          </View>
          <Text className="text-[#0F0032] text-3xl font-black tracking-tight">HU NOW</Text>
          <Text className="text-[#0F0032]/40 text-sm mt-1">Hull's city card app</Text>
        </View>

        {/* Card */}
        <View className="bg-white rounded-3xl p-6 mb-4"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20 }}
        >
          <Text className="text-[#0F0032] text-xl font-bold mb-5">Sign in</Text>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          )}

          <View className="bg-[#F5F5F7] rounded-2xl px-4 py-4 mb-3 border border-[#E5E5EA]">
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

          <View className="bg-[#F5F5F7] rounded-2xl px-4 py-4 mb-6 border border-[#E5E5EA]">
            <Text className="text-[#0F0032]/40 text-xs mb-1">Password</Text>
            <TextInput
              className="text-[#0F0032] text-base"
              placeholder="••••••••"
              placeholderTextColor="rgba(15,0,50,0.25)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
          </View>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: -10, marginBottom: 18 }}>
              <Text className="text-[#0F0032] text-sm font-bold">Forgot password?</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity
            className="bg-[#0F0032] rounded-2xl py-4 items-center"
            onPress={handleLogin}
            disabled={loading}
            style={{ shadowColor: "#0F0032", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }}
          >
            {loading
              ? <ActivityIndicator color="#FBC900" />
              : <Text className="text-white font-bold text-base">Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center">
          <Text className="text-[#0F0032]/40 text-sm">Don't have an account? </Text>
          <Link href="/(auth)/register">
            <Text className="text-[#0F0032] text-sm font-bold">Get my card</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
