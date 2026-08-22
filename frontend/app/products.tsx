import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { PublicHeader } from "@/src/components/PublicHeader";
import { PublicProductCard } from "@/src/components/PublicProductCard";
import { theme } from "@/src/theme";

type Product = { id: string; name: string; price: number; mrp?: number; stock?: number; image_url?: string | null; image?: string | null; category_id?: string };
type Result = { items: Product[]; total: number };

export default function ProductsPage() {
  const params = useLocalSearchParams<{ q?: string; category_id?: string; name?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [result, setResult] = useState<Result>({ items: [], total: 0 });
  const [sort, setSort] = useState("popular");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const columns = width >= 1200 ? 4 : width >= 760 ? 3 : 2;
  const contentWidth = Math.min(width - 32, 1320);
  const gap = 14;
  const cardWidth = Math.max(0, (contentWidth - gap * (columns - 1)) / columns);

  useEffect(() => {
    setLoading(true);
    setError("");
    const min = minPrice.trim() ? Number(minPrice) : undefined;
    const max = maxPrice.trim() ? Number(maxPrice) : undefined;
    api<Result>("/public/products", {
      skipAuth: true,
      query: {
        q: params.q,
        category_id: params.category_id,
        sort,
        min_price: Number.isFinite(min) ? min : undefined,
        max_price: Number.isFinite(max) ? max : undefined,
        in_stock: inStock,
      },
    })
      .then(setResult)
      .catch((e) => setError(e?.message || "Unable to load products"))
      .finally(() => setLoading(false));
  }, [params.q, params.category_id, sort, minPrice, maxPrice, inStock]);

  const title = useMemo(() => params.q ? `Search results for “${params.q}”` : params.name || "All Products", [params.q, params.name]);

  const resetFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setInStock(true);
    setSort("popular");
  };

  return (
    <View style={styles.page}>
      <PublicHeader initialQuery={params.q || ""} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.content, { maxWidth: contentWidth }]}>
          <View style={styles.top}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.sub}>{result.total} products available</Text>
            </View>
            <View style={styles.sorts}>
              {["popular", "newest", "price_asc", "price_desc"].map((s) => (
                <Pressable key={s} onPress={() => setSort(s)} style={[styles.sort, sort === s && styles.sortActive]}>
                  <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                    {s === "price_asc" ? "Price ↑" : s === "price_desc" ? "Price ↓" : s === "newest" ? "Newest" : "Popular"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterCard}>
            <View style={styles.filterHeading}>
              <View style={styles.filterTitleWrap}>
                <Feather name="sliders" size={17} color={theme.colors.text} />
                <Text style={styles.filterTitle}>Filters</Text>
              </View>
              <Pressable onPress={resetFilters}><Text style={styles.reset}>Reset</Text></Pressable>
            </View>
            <View style={styles.filterRow}>
              <View style={styles.priceField}>
                <Text style={styles.fieldLabel}>Min price</Text>
                <TextInput
                  value={minPrice}
                  onChangeText={(v) => setMinPrice(v.replace(/[^0-9]/g, "").slice(0, 8))}
                  keyboardType="numeric"
                  placeholder="₹ 0"
                  style={styles.input}
                />
              </View>
              <View style={styles.priceField}>
                <Text style={styles.fieldLabel}>Max price</Text>
                <TextInput
                  value={maxPrice}
                  onChangeText={(v) => setMaxPrice(v.replace(/[^0-9]/g, "").slice(0, 8))}
                  keyboardType="numeric"
                  placeholder="₹ 100000"
                  style={styles.input}
                />
              </View>
              <Pressable onPress={() => setInStock((v) => !v)} style={styles.stockToggle}>
                <View style={[styles.checkbox, inStock && styles.checkboxActive]}>
                  {inStock ? <Feather name="check" size={13} color="#fff" /> : null}
                </View>
                <Text style={styles.stockText}>In stock only</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.loader}><ActivityIndicator color={theme.colors.primary} size="large" /></View>
          ) : error ? (
            <View style={styles.empty}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => router.replace("/products" as any)} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
            </View>
          ) : result.items.length ? (
            <View style={styles.grid}>{result.items.map((p) => <View key={p.id} style={{ width: cardWidth }}><PublicProductCard product={p} /></View>)}</View>
          ) : (
            <View style={styles.empty}>
              <Feather name="search" size={32} color={theme.colors.textSubtle} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.sub}>Try another search or adjust your filters.</Text>
              <Pressable onPress={resetFilters} style={styles.retry}><Text style={styles.retryText}>Clear Filters</Text></Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  scroll: { paddingBottom: 48 },
  content: { width: "100%", alignSelf: "center", paddingHorizontal: 16 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", paddingTop: 26, paddingBottom: 18 },
  title: { fontSize: 28, fontWeight: "900", color: theme.colors.text },
  sub: { marginTop: 5, color: theme.colors.textMuted, fontSize: 13 },
  sorts: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  sort: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "#fff" },
  sortActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  sortText: { fontSize: 11, fontWeight: "700", color: theme.colors.textMuted },
  sortTextActive: { color: "#fff" },
  filterCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, marginBottom: 18 },
  filterHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  filterTitleWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  filterTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "900" },
  reset: { color: theme.colors.primaryHover, fontSize: 12, fontWeight: "800" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 10 },
  priceField: { width: 150, maxWidth: "100%" },
  fieldLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 5 },
  input: { height: 40, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, backgroundColor: "#FAFAFA", color: theme.colors.text },
  stockToggle: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, cursor: "pointer" as any },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  stockText: { color: theme.colors.text, fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  loader: { minHeight: 350, alignItems: "center", justifyContent: "center" },
  empty: { minHeight: 350, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  error: { color: theme.colors.danger },
  retry: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.colors.primary, borderRadius: 7 },
  retryText: { color: "#fff", fontWeight: "800" },
});
