import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Link, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth, isAdminRole } from "@/src/context/AuthContext";
import { PublicHeader } from "@/src/components/PublicHeader";
import { PublicProductCard } from "@/src/components/PublicProductCard";
import { theme } from "@/src/theme";

type Product = { id: string; name: string; price: number; mrp?: number; stock?: number; image_url?: string | null; image?: string | null; category_id?: string };
type Category = { id: string; name: string; image_url?: string | null; icon?: string | null };
type HomeData = { categories: Category[]; featured: Product[]; newest: Product[]; deals: Product[]; platform_name?: string; support_mobile?: string };
type Serviceability = { serviceable: boolean; reason?: string; message?: string; zone?: { id: string; name: string; extra_delivery_charge?: number } };

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [serviceability, setServiceability] = useState<Serviceability | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (user && isAdminRole(user.role)) {
      router.replace("/admin/dashboard");
      return;
    }
    api<HomeData>("/public/home", { skipAuth: true })
      .then(setData)
      .catch((e) => setError(e?.message || "Unable to load NEDS STORE"))
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  const checkLocation = () => {
    if (Platform.OS !== "web") {
      setServiceability({
        serviceable: false,
        reason: "app_location_pending",
        message: "Mobile location flow will be enabled in the Customer App.",
      });
      return;
    }
    if (!navigator.geolocation) {
      setServiceability({
        serviceable: false,
        reason: "geolocation_unavailable",
        message: "Location access is not available in this browser. Please use your delivery address at checkout.",
      });
      return;
    }

    setLocationLoading(true);
    setServiceability(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await api<Serviceability>("/public/check-location", {
            method: "POST",
            body: { lat: coords.latitude, lng: coords.longitude },
            skipAuth: true,
          });
          setServiceability(result);
        } catch (e: any) {
          setServiceability({
            serviceable: false,
            reason: "check_failed",
            message: e?.message || "Serviceability check failed. Please try again.",
          });
        } finally {
          setLocationLoading(false);
        }
      },
      (geoError) => {
        setLocationLoading(false);
        setServiceability({
          serviceable: false,
          reason: geoError.code === 1 ? "permission_denied" : "location_error",
          message: geoError.code === 1
            ? "Location permission was denied. You can continue and add an address during checkout."
            : "Unable to get your location. Please try again or add an address during checkout.",
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const columns = width >= 1200 ? 4 : width >= 760 ? 3 : 2;
  const gap = 14;
  const contentWidth = Math.min(width - 32, 1320);
  const cardWidth = Math.max(0, (contentWidth - gap * (columns - 1)) / columns);

  if (authLoading || (user && isAdminRole(user.role))) return <View style={styles.loader}><ActivityIndicator color={theme.colors.primary} size="large" /></View>;

  return (
    <View style={styles.page}>
      <PublicHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.content, { maxWidth: contentWidth }]}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>NEDS STORE • HYPERLOCAL MARKETPLACE</Text>
              <Text style={styles.heroTitle}>Everything you need, delivered locally.</Text>
              <Text style={styles.heroText}>Shop from approved local sellers with fast delivery, transparent pricing and one trusted NEDS STORE experience.</Text>
              <View style={styles.heroActions}>
                <Link href="/products" asChild><Pressable style={styles.primaryBtn}><Text style={styles.primaryText}>Shop Products</Text><Feather name="arrow-right" size={16} color="#fff" /></Pressable></Link>
                <Link href="/search" asChild><Pressable style={styles.secondaryBtn}><Text style={styles.secondaryText}>Explore Categories</Text></Pressable></Link>
              </View>
            </View>
            <View style={styles.heroVisual}><View style={styles.heroCircle}><Feather name="shopping-bag" size={68} color={theme.colors.primary} /></View><Text style={styles.heroBadge}>LOCAL • FAST • TRUSTED</Text></View>
          </View>

          <View style={styles.locationCard}>
            <View style={styles.locationIcon}><Feather name="map-pin" size={22} color={theme.colors.primary} /></View>
            <View style={styles.locationCopy}>
              <Text style={styles.locationTitle}>Check delivery availability</Text>
              <Text style={styles.locationText}>
                {serviceability?.serviceable
                  ? `Available in ${serviceability.zone?.name || "your area"}.`
                  : serviceability?.message || "Check whether NEDS STORE delivers to your current location."}
              </Text>
            </View>
            <Pressable onPress={checkLocation} disabled={locationLoading} style={styles.locationBtn}>
              {locationLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.locationBtnText}>{serviceability?.serviceable ? "Check Again" : "Use My Location"}</Text>}
            </Pressable>
          </View>

          <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Shop by Category</Text><Text style={styles.sectionSub}>Discover products from your local marketplace</Text></View><Link href="/products" asChild><Pressable><Text style={styles.viewAll}>View all →</Text></Pressable></Link></View>
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : data?.categories?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {data.categories.map((cat) => <Link key={cat.id} href={{ pathname: "/category/[id]", params: { id: cat.id, name: cat.name } } as any} asChild><Pressable style={styles.categoryCard}><View style={styles.categoryIcon}><Feather name="grid" size={20} color={theme.colors.primary} /></View><Text style={styles.categoryName} numberOfLines={2}>{cat.name}</Text></Pressable></Link>)}
            </ScrollView>
          ) : <Text style={styles.empty}>{error || "Categories will appear here when sellers add them."}</Text>}

          <ProductSection title="Featured Products" products={data?.featured || []} cardWidth={cardWidth} />
          <ProductSection title="Best Deals" products={data?.deals || []} cardWidth={cardWidth} />
          <ProductSection title="New Arrivals" products={data?.newest || []} cardWidth={cardWidth} />

          <View style={styles.trustRow}>
            <Trust icon="map-pin" title="Local Delivery" text="Serviceability checked by delivery zone" />
            <Trust icon="shield" title="Secure Checkout" text="Protected account and payment flows" />
            <Trust icon="truck" title="Fast Fulfilment" text="Seller and rider workflows stay connected" />
            <Trust icon="headphones" title="Support" text="Help when you need it" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ProductSection({ title, products, cardWidth }: { title: string; products: Product[]; cardWidth: number }) {
  if (!products.length) return null;
  return <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Link href="/products" asChild><Pressable><Text style={styles.viewAll}>View all →</Text></Pressable></Link></View><View style={styles.grid}>{products.map((p) => <View key={p.id} style={{ width: cardWidth }}><PublicProductCard product={p} /></View>)}</View></View>;
}

function Trust({ icon, title, text }: { icon: any; title: string; text: string }) { return <View style={styles.trust}><View style={styles.trustIcon}><Feather name={icon} size={19} color={theme.colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.trustTitle}>{title}</Text><Text style={styles.trustText}>{text}</Text></View></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  scroll: { paddingBottom: 48 },
  content: { width: "100%", alignSelf: "center", paddingHorizontal: 16 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF8" },
  hero: { marginTop: 20, minHeight: 360, borderRadius: 20, padding: 34, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#D1FAE5", flexDirection: "row", alignItems: "center", overflow: "hidden" },
  heroCopy: { flex: 1, maxWidth: 720 },
  eyebrow: { color: theme.colors.primaryHover, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 12 },
  heroTitle: { color: theme.colors.text, fontSize: 42, lineHeight: 49, fontWeight: "900", maxWidth: 650 },
  heroText: { color: "#374151", fontSize: 16, lineHeight: 25, marginTop: 14, maxWidth: 650 },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 24, flexWrap: "wrap" },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8, cursor: "pointer" as any },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "#fff", cursor: "pointer" as any },
  secondaryText: { color: theme.colors.text, fontWeight: "700", fontSize: 14 },
  heroVisual: { width: 300, alignItems: "center", justifyContent: "center" },
  heroCircle: { width: 190, height: 190, borderRadius: 95, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  heroBadge: { marginTop: 14, fontSize: 10, fontWeight: "900", color: theme.colors.primaryHover, letterSpacing: 1 },
  locationCard: { marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
  locationIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" },
  locationCopy: { flex: 1 },
  locationTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "900" },
  locationText: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  locationBtn: { minWidth: 128, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", cursor: "pointer" as any },
  locationBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  section: { marginTop: 34 },
  sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 30, marginBottom: 14 },
  sectionTitle: { color: theme.colors.text, fontSize: 23, fontWeight: "850" as any },
  sectionSub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4 },
  viewAll: { color: theme.colors.primaryHover, fontWeight: "800", fontSize: 13 },
  categoryRow: { gap: 10, paddingVertical: 4 },
  categoryCard: { width: 145, minHeight: 112, padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, alignItems: "center", justifyContent: "center", cursor: "pointer" as any },
  categoryIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  categoryName: { color: theme.colors.text, fontWeight: "700", fontSize: 13, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  empty: { color: theme.colors.textMuted, paddingVertical: 20 },
  trustRow: { marginTop: 44, padding: 20, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", flexWrap: "wrap", gap: 16 },
  trust: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 220 },
  trustIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" },
  trustTitle: { color: theme.colors.text, fontWeight: "800", fontSize: 13 },
  trustText: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
});
