import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { PublicHeader } from "@/src/components/PublicHeader";
import { PublicProductCard } from "@/src/components/PublicProductCard";
import { useCart } from "@/src/context/CartContext";
import { theme, inr } from "@/src/theme";

type Product = { id: string; name: string; description?: string; price: number; mrp?: number; stock?: number; image_url?: string | null; image?: string | null; category_id?: string };
type Data = { product: Product; seller?: { id: string; name?: string; verified?: boolean } | null; category?: { id: string; name: string } | null; related: Product[] };

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { addToCart } = useCart();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!id) return;
    api<Data>(`/public/product/${id}`, { skipAuth: true }).then(setData).catch((e) => setMessage(e?.message || "Product not found")).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={styles.loader}><ActivityIndicator color={theme.colors.primary} size="large" /></View>;
  if (!data) return <View style={styles.loader}><Text style={styles.error}>{message || "Product not found"}</Text></View>;
  const p = data.product;
  const image = p.image_url || p.image || null;
  const discount = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  return <View style={styles.page}><PublicHeader /><ScrollView contentContainerStyle={styles.scroll}><View style={[styles.content, { maxWidth: Math.min(width - 32, 1180) }]}>
    <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={16} color={theme.colors.textMuted} /><Text style={styles.backText}>Back to products</Text></Pressable>
    <View style={styles.detail}>
      <View style={styles.imagePanel}>{image ? <Image source={{ uri: image }} style={styles.image} resizeMode="contain" /> : <View style={styles.placeholder}><Text style={styles.placeholderText}>NEDS STORE</Text></View>}</View>
      <View style={styles.info}>
        {data.category ? <Text style={styles.category}>{data.category.name}</Text> : null}
        <Text style={styles.name}>{p.name}</Text>
        <View style={styles.priceRow}><Text style={styles.price}>{inr(p.price)}</Text>{p.mrp && p.mrp > p.price ? <Text style={styles.mrp}>{inr(p.mrp)}</Text> : null}{discount > 0 ? <Text style={styles.discount}>{discount}% OFF</Text> : null}</View>
        <Text style={[styles.stock, !(p.stock && p.stock > 0) && { color: theme.colors.danger }]}>{p.stock && p.stock > 0 ? `${p.stock} available` : "Currently unavailable"}</Text>
        {data.seller ? <View style={styles.seller}><Feather name="shopping-bag" size={18} color={theme.colors.primary} /><View><Text style={styles.sellerLabel}>Sold by</Text><Text style={styles.sellerName}>{data.seller.name || "Approved seller"}{data.seller.verified ? " • Verified" : ""}</Text></View></View> : null}
        {p.description ? <Text style={styles.description}>{p.description}</Text> : null}
        <View style={styles.actions}><Pressable disabled={!(p.stock && p.stock > 0)} onPress={() => { addToCart({ product_id: p.id, name: p.name, price: p.price, stock: p.stock || 0, image_base64: image || undefined }, 1); setMessage("Added to cart"); }} style={[styles.cartBtn, !(p.stock && p.stock > 0) && styles.disabled]}><Feather name="shopping-cart" size={17} color="#fff" /><Text style={styles.cartText}>Add to Cart</Text></Pressable><Pressable onPress={() => router.push("/cart" as any)} style={styles.buyBtn}><Text style={styles.buyText}>View Cart</Text></Pressable></View>
        {message ? <Text style={styles.success}>{message}</Text> : null}
      </View>
    </View>
    {data.related?.length ? <View style={styles.related}><Text style={styles.relatedTitle}>You may also like</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>{data.related.map((r) => <View key={r.id} style={{ width: 230 }}><PublicProductCard product={r} /></View>)}</ScrollView></View> : null}
  </View></ScrollView></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#FAFAF8" }, scroll: { paddingBottom: 48 }, content: { width: "100%", alignSelf: "center", paddingHorizontal: 16 }, loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF8" }, error: { color: theme.colors.danger }, back: { flexDirection: "row", gap: 7, alignItems: "center", paddingVertical: 18 }, backText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "700" }, detail: { flexDirection: "row", gap: 32, flexWrap: "wrap" }, imagePanel: { width: 480, height: 500, maxWidth: "100%", backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, alignItems: "center", justifyContent: "center" }, image: { width: "100%", height: "100%" }, placeholder: { width: 150, height: 150, borderRadius: 30, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" }, placeholderText: { color: theme.colors.primaryHover, fontWeight: "900" }, info: { flex: 1, minWidth: 300, paddingTop: 10 }, category: { color: theme.colors.primaryHover, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }, name: { color: theme.colors.text, fontSize: 34, lineHeight: 42, fontWeight: "900", marginTop: 8 }, priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 }, price: { fontSize: 28, fontWeight: "900", color: theme.colors.text }, mrp: { fontSize: 15, color: theme.colors.textMuted, textDecorationLine: "line-through" }, discount: { fontSize: 12, color: theme.colors.primaryHover, fontWeight: "900", backgroundColor: theme.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5 }, stock: { marginTop: 8, color: theme.colors.success, fontWeight: "700" }, seller: { marginTop: 24, padding: 14, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", gap: 10, alignItems: "center" }, sellerLabel: { fontSize: 10, color: theme.colors.textMuted }, sellerName: { fontSize: 13, color: theme.colors.text, fontWeight: "800", marginTop: 2 }, description: { marginTop: 22, color: "#374151", fontSize: 14, lineHeight: 23 }, actions: { flexDirection: "row", gap: 10, marginTop: 26, flexWrap: "wrap" }, cartBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 8 }, cartText: { color: "#fff", fontWeight: "800" }, buyBtn: { paddingHorizontal: 20, paddingVertical: 13, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border }, buyText: { color: theme.colors.text, fontWeight: "800" }, disabled: { opacity: 0.45 }, success: { marginTop: 10, color: theme.colors.success, fontWeight: "700" }, related: { marginTop: 46 }, relatedTitle: { color: theme.colors.text, fontSize: 22, fontWeight: "900", marginBottom: 14 }, relatedRow: { gap: 14 } });
