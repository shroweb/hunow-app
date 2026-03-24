import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";

type Role = "customer" | "business";

export default function RegisterScreen() {
  const [role, setRole] = useState<Role>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Profile is created via Supabase trigger (see migration)
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-navy"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-8 pt-16 pb-8">
        <Text className="text-brand-yellow text-4xl font-bold mb-2">HU NOW</Text>
        <Text className="text-white text-base mb-8 opacity-70">Create your account</Text>

        {/* Role Toggle */}
        <View className="flex-row bg-white/10 rounded-xl p-1 mb-6">
          {(["customer", "business"] as Role[]).map((r) => (
            <TouchableOpacity
              key={r}
              className={`flex-1 py-3 rounded-lg items-center ${role === r ? "bg-brand-yellow" : ""}`}
              onPress={() => setRole(r)}
            >
              <Text className={`font-semibold text-sm capitalize ${role === r ? "text-brand-navy" : "text-white/60"}`}>
                {r === "customer" ? "Card Holder" : "Business"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        <TextInput
          className="bg-white/10 text-white rounded-xl px-4 py-4 mb-3 text-base border border-white/20"
          placeholder={role === "business" ? "Business Name" : "Full Name"}
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={name}
          onChangeText={setName}
        />
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
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0F0032" />
            : <Text className="text-brand-navy font-bold text-base">Create Account</Text>
          }
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-white/50 text-sm">Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text className="text-brand-yellow text-sm font-semibold">Sign In</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
