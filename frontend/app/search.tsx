import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";

export default function SearchPage() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: "/products", params: q ? { q } : {} } as any);
  }, [q, router]);
  return <View style={styles.loader}><ActivityIndicator color={theme.colors.primary} size="large" /></View>;
}
const styles = StyleSheet.create({ loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF8" } });
