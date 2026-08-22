import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export default function RegisterScreen() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!name.trim() || !/^\d{10}$/.test(mobile)) return setError("नाम और 10 अंकों का मोबाइल नंबर भरें।");
    if (password.length < 6) return setError("पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।");
    if (password !== confirm) return setError("पासवर्ड और कन्फर्म पासवर्ड समान नहीं हैं।");
    setLoading(true);
    try {
      const res = await api<{ access_token: string; user: any }>("/public/register", {
        method: "POST",
        body: { name: name.trim(), mobile, password, email: email.trim() || undefined },
        skipAuth: true,
      });
      // Use the existing auth context only after registration succeeds.
      await login(mobile, password);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Registration failed. कृपया फिर प्रयास करें।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.brand}>NEDS STORE</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>खरीदारी शुरू करने के लिए ग्राहक खाता बनाएं।</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TextInput style={styles.input} placeholder="पूरा नाम" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="मोबाइल नंबर" value={mobile} onChangeText={v => setMobile(v.replace(/\D/g, "").slice(0, 10))} keyboardType="phone-pad" maxLength={10} />
        <TextInput style={styles.input} placeholder="ईमेल (वैकल्पिक)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="पासवर्ड" value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="कन्फर्म पासवर्ड" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace("/login")} style={styles.linkWrap}>
          <Text style={styles.link}>पहले से खाता है? Login करें</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: "#f7f8f6" },
  card: { width: "100%", maxWidth: 520, alignSelf: "center", backgroundColor: "#fff", borderRadius: 18, padding: 24, gap: 12, elevation: 2 },
  brand: { fontSize: 14, fontWeight: "800", letterSpacing: 1.5 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#667085", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d9dde3", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: "#fff" },
  button: { backgroundColor: "#111", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  error: { color: "#b42318", backgroundColor: "#fef3f2", padding: 10, borderRadius: 8 },
  linkWrap: { alignItems: "center", paddingVertical: 8 },
  link: { fontWeight: "700" },
});
