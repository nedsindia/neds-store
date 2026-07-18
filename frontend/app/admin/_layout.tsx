import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Slot, useRouter } from "expo-router";

import { Sidebar } from "@/src/components/Sidebar";
import { Header } from "@/src/components/Header";
import { useAuth, isAdminRole } from "@/src/context/AuthContext";
import { theme } from "@/src/theme";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!isAdminRole(user.role)) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isDesktop) {
    return (
      <View style={styles.notSupported} testID="admin-mobile-notice">
        <Text style={styles.notSupportedTitle}>Desktop Recommended</Text>
        <Text style={styles.notSupportedText}>
          The NEDS STORE Admin Portal is optimized for desktop and laptop browsers. Please open this
          URL on a wider screen (≥ 900px) for the best experience.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="admin-shell">
      <Sidebar />
      <View style={{ flex: 1, flexDirection: "column" }}>
        <Header />
        <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
          <Slot />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: theme.colors.bg,
  },
  main: {
    flex: 1,
    backgroundColor: theme.colors.bgSecondary,
  },
  mainContent: {
    padding: 32,
    gap: 24,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  notSupported: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#fff",
    gap: 12,
  },
  notSupportedTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
  },
  notSupportedText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
    maxWidth: 460,
    lineHeight: 22,
  },
});
