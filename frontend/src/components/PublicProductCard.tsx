import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { theme, inr } from "@/src/theme";

type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  stock?: number;
  image_url?: string | null;
  image?: string | null;
  category_name?: string | null;
};

export function PublicProductCard({ product }: { product: Product }) {
  const image = product.image_url || product.image || null;
  const discount = product.mrp && product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return (
    <Link href={{ pathname: "/product/[id]", params: { id: product.id } } as any} asChild>
      <Pressable style={styles.card}>
        <View style={styles.imageWrap}>
          {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="contain" /> : <View style={styles.placeholder}><Text style={styles.placeholderText}>NEDS</Text></View>}
          {discount > 0 ? <View style={styles.discount}><Text style={styles.discountText}>{discount}% OFF</Text></View> : null}
        </View>
        <View style={styles.body}>
          {product.category_name ? <Text style={styles.category} numberOfLines={1}>{product.category_name}</Text> : null}
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{inr(product.price)}</Text>
            {product.mrp && product.mrp > product.price ? <Text style={styles.mrp}>{inr(product.mrp)}</Text> : null}
          </View>
          <Text style={styles.stock}>{product.stock && product.stock > 0 ? "In stock" : "Currently unavailable"}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, overflow: "hidden", cursor: "pointer" as any },
  imageWrap: { height: 190, backgroundColor: "#FAFAFA", position: "relative", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  placeholder: { width: 72, height: 72, borderRadius: 16, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  discount: { position: "absolute", top: 10, left: 10, backgroundColor: theme.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  discountText: { color: theme.colors.primaryHover, fontSize: 10, fontWeight: "800" },
  body: { padding: 12 },
  category: { color: theme.colors.textMuted, fontSize: 10, textTransform: "uppercase", marginBottom: 5 },
  name: { color: theme.colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20, minHeight: 40 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  price: { color: theme.colors.text, fontSize: 17, fontWeight: "800" },
  mrp: { color: theme.colors.textMuted, fontSize: 12, textDecorationLine: "line-through" },
  stock: { marginTop: 6, color: theme.colors.success, fontSize: 11, fontWeight: "600" },
});
