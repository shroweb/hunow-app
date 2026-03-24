import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-navy"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-brand-yellow text-4xl font-bold mb-2">HU NOW</Text>
        <Text className="text-white text-base mb-10 opacity-70">Sign in to your account</Text>

        {error && (
          <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        <TextInput
          className="bg-white/10 text-white rounded-xl px-4 py-4 mb-3 text-base border border-white/20"
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          className="bg-white/10 text-white rounded-xl px-4 py-4 mb-6 text-base border border-white/20"
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          className="bg-brand-yellow rounded-xl py-4 items-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0F0032" />
            : <Text className="text-brand-navy font-bold text-base">Sign In</Text>
          }
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-white/50 text-sm">Don't have an account? </Text>
          <Link href="/(auth)/register">
            <Text className="text-brand-yellow text-sm font-semibold">Register</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
