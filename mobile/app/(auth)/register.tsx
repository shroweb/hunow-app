import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/context/AuthContext";

const BRAND_LOGO_URL = "https://hunow.co.uk/wp-content/uploads/2025/02/Group-1-1.png";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed. Please try again.");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F5F7]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 32, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View className="items-center mb-10">
          <Image
            source={{ uri: BRAND_LOGO_URL }}
            style={{ width: 124, height: 56, marginLeft: -18, marginBottom: 12, alignSelf: "center" }}
            resizeMode="contain"
          />
          <Text className="text-[#0F0032]/40 text-sm mt-1">Get your free city card</Text>
        </View>

        {/* Card */}
        <View className="bg-white rounded-3xl p-6 mb-4"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20 }}
        >
          <Text className="text-[#0F0032] text-xl font-bold mb-2">Create account</Text>
          <Text className="text-[#0F0032]/40 text-sm mb-5">
            Join HU NOW and unlock exclusive deals across Hull.
          </Text>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          )}

          <View className="bg-[#F5F5F7] rounded-2xl px-4 py-4 mb-3 border border-[#E5E5EA]">
            <Text className="text-[#0F0032]/40 text-xs mb-1">Full name</Text>
            <TextInput
              className="text-[#0F0032] text-base"
              placeholder="Jane Smith"
              placeholderTextColor="rgba(15,0,50,0.25)"
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
          </View>

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
              placeholder="Min. 8 characters"
              placeholderTextColor="rgba(15,0,50,0.25)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <TouchableOpacity
            className="bg-brand-yellow rounded-2xl py-4 items-center"
            onPress={handleRegister}
            disabled={loading}
            style={{ shadowColor: "#FBC900", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 }}
          >
            {loading
              ? <ActivityIndicator color="#0F0032" />
              : <Text className="text-[#0F0032] font-bold text-base">Get My Card</Text>
            }
          </TouchableOpacity>
        </View>

        <Text className="text-[#0F0032]/30 text-xs text-center mb-4">
          By creating an account you agree to the HU NOW terms of service.
        </Text>

        <View className="flex-row justify-center">
          <Text className="text-[#0F0032]/40 text-sm">Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text className="text-[#0F0032] text-sm font-bold">Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
