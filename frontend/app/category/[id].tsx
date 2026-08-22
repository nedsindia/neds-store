import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";

export default function CategoryPage() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!id) {
      router.replace("/products" as any);
      return;
    }
    router.replace({ pathname: "/products", params: { category_id: id, name: name || "Category" } } as any);
  }, [id, name, router]);

  return <View style={styles.loader}><ActivityIndicator color={theme.colors.primary} size="large" /></View>;
}

const styles = StyleSheet.create({ loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF8" } });
