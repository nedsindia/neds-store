import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { useAuth, isAdminRole } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

export default function Login() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();

  const [mobile, setMobile] = useState(process.env.EXPO_PUBLIC_DEMO_MODE === "1" ? "9999999999" : "");
  const [password, setPassword] = useState(process.env.EXPO_PUBLIC_DEMO_MODE === "1" ? "Admin@123" : "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});

  useEffect(() => {
    if (!loading && user) {
      router.replace(isAdminRole(user.role) ? "/admin/dashboard" : "/login");
    }
  }, [user, loading, router]);

  const validate = () => {
    const e: typeof errors = {};
    if (!/^\d{10}$/.test(mobile)) e.mobile = "Enter a valid 10-digit mobile number";
    if (password.length < 4) e.password = "Password required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const u = await login(mobile, password);
      toast.success(`Welcome, ${u.name}`);
      router.replace(isAdminRole(u.role) ? "/admin/dashboard" : "/login");
      if (!isAdminRole(u.role)) toast.info("Only Admin roles can access the Admin Portal in Phase 1");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const isDesktop = width >= 900;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={[styles.container, !isDesktop && { flexDirection: "column" }]} testID="login-screen">
        {/* Left branding pane */}
        {isDesktop && (
          <View style={styles.brandPane}>
            <View style={styles.brandInner}>
              <View style={styles.logoBox}>
                <Text style={styles.logoLetter}>N</Text>
              </View>
              <Text style={styles.brandTitle}>NEDS STORE</Text>
              <Text style={styles.brandSubtitle}>Next Era Digital Solutions</Text>
              <Text style={styles.brandTagline}>Learn • Grow • Succeed</Text>

              <View style={styles.brandFeatures}>
                {[
                  { icon: "shield", label: "Enterprise-grade RBAC" },
                  { icon: "truck", label: "Hyperlocal delivery orchestration" },
                  { icon: "activity", label: "Live business rules engine" },
                  { icon: "map-pin", label: "Live rider monitoring on Google Maps" },
                ].map((f) => (
                  <View key={f.label} style={styles.featureRow}>
                    <Feather name={f.icon as any} size={16} color={theme.colors.primary} />
                    <Text style={styles.featureLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.brandFooter}>
                <Text style={styles.brandFooterText}>© 2026 NEDS STORE • v1.0</Text>
              </View>
            </View>
          </View>
        )}

        {/* Right form pane */}
        <ScrollView
          style={styles.formPane}
          contentContainerStyle={styles.formPaneContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard} testID="login-form">
            {!isDesktop && (
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <View style={styles.logoBoxSm}>
                  <Text style={styles.logoLetterSm}>N</Text>
                </View>
                <Text style={styles.brandTitleSm}>NEDS STORE</Text>
                <Text style={styles.brandTaglineSm}>Learn • Grow • Succeed</Text>
              </View>
            )}
            <Text style={styles.title}>Admin Portal Login</Text>
            <Text style={styles.subtitle}>Sign in using your mobile number and password</Text>

            <View style={{ gap: 16, marginTop: 24 }}>
              <Input
                label="Mobile Number"
                testID="login-mobile-input"
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile"
                keyboardType="number-pad"
                maxLength={10}
                error={errors.mobile}
                autoCapitalize="none"
              />
              <Input
                label="Password"
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                error={errors.password}
                autoCapitalize="none"
                onSubmitEditing={handleLogin}
              />
              <Button
                title={submitting ? "Signing in…" : "Sign In"}
                onPress={handleLogin}
                loading={submitting}
                fullWidth
                testID="login-submit-button"
              />
            </View>

            {process.env.EXPO_PUBLIC_DEMO_MODE === "1" ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintLabel}>Demo Super Admin</Text>
                <Text style={styles.hintText}>Mobile: <Text style={{ fontFamily: theme.fonts.mono }}>9999999999</Text></Text>
                <Text style={styles.hintText}>Password: <Text style={{ fontFamily: theme.fonts.mono }}>Admin@123</Text></Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  brandPane: {
    width: "42%",
    backgroundColor: theme.colors.surface,
    padding: 48,
    justifyContent: "center",
    // @ts-ignore
    backgroundImage:
      "radial-gradient(circle at 20% 20%, rgba(5,150,105,0.20), transparent 50%), radial-gradient(circle at 80% 80%, rgba(5,150,105,0.10), transparent 50%)",
  } as any,
  brandInner: {
    maxWidth: 480,
    gap: 12,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoLetter: {
    color: "#fff",
    fontFamily: theme.fonts.heading,
    fontSize: 28,
    fontWeight: "800",
  },
  brandTitle: {
    color: "#fff",
    fontFamily: theme.fonts.heading,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: "#A1A1AA",
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  brandTagline: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 32,
  },
  brandFeatures: {
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureLabel: {
    color: "#D4D4D8",
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  brandFooter: {
    marginTop: 40,
  },
  brandFooterText: {
    color: "#52525B",
    fontFamily: theme.fonts.mono,
    fontSize: 11,
  },
  formPane: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  formPaneContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  formCard: {
    width: "100%",
    maxWidth: 420,
  },
  logoBoxSm: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoLetterSm: {
    color: "#fff",
    fontFamily: theme.fonts.heading,
    fontSize: 24,
    fontWeight: "800",
  },
  brandTitleSm: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
  },
  brandTaglineSm: {
    fontFamily: theme.fonts.body,
    color: theme.colors.primary,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "600",
    marginTop: 4,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  hintBox: {
    marginTop: 24,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgSecondary,
  },
  hintLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  hintText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 20,
  },
});
