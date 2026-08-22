import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PublicHeader } from "@/src/components/PublicHeader";
import { useAuth } from "@/src/context/AuthContext";
import { useCart } from "@/src/context/CartContext";
import { api } from "@/src/api/client";
import { theme, inr } from "@/src/theme";

type Address = { id: string; label: string; name: string; mobile: string; line1: string; city: string; state: string; pincode: string; lat?: number | null; lng?: number | null; is_default?: boolean };

type Preview = { subtotal: number; delivery_breakdown?: { final_delivery_charge?: number; reject?: boolean; message?: string }; estimated_total?: number | null };

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [payment, setPayment] = useState<"cod" | "upi" | "phonepe">("cod");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const address = useMemo(() => addresses.find(a => a.id === selected) || null, [addresses, selected]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    if (!items.length) { router.replace("/cart"); return; }
    (async () => {
      try {
        const r = await api<{ items: Address[] }>("/customer/addresses");
        const list = r.items || [];
        setAddresses(list);
        const d = list.find(a => a.is_default) || list[0];
        if (d) setSelected(d.id);
      } catch (e: any) { setError(e?.message || "Address load नहीं हुआ।"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user, items.length]);

  useEffect(() => {
    if (!address?.lat || !address?.lng || !items.length) { setPreview(null); return; }
    (async () => {
      try {
        const r = await api<Preview>("/checkout/preview", { method: "POST", body: { items: items.map(i => ({ product_id: i.product_id, qty: i.qty })), customer_lat: address.lat, customer_lng: address.lng, order_subtotal: subtotal } });
        setPreview(r); setError(r.delivery_breakdown?.reject ? (r.delivery_breakdown.message || "Delivery unavailable") : "");
      } catch (e: any) { setPreview(null); setError(e?.message || "Delivery charge calculate नहीं हो पाया।"); }
    })();
  }, [address?.id, address?.lat, address?.lng, subtotal, items]);

  const placeOrder = async () => {
    if (!address) return setError("पहले delivery address चुनें।");
    if (address.lat == null || address.lng == null) return setError("इस address में GPS coordinates नहीं हैं। Addresses में जाकर latitude और longitude जोड़ें।");
    setError(""); setPlacing(true);
    try {
      const order = await api<any>("/orders", { method: "POST", body: {
        items: items.map(i => ({ product_id: i.product_id, name: i.name, price: i.price, qty: i.qty, seller_id: (i as any).seller_id || null })),
        delivery_address: `${address.name}, ${address.line1}, ${address.city}, ${address.state} - ${address.pincode}`,
        delivery_lat: address.lat, delivery_lng: address.lng, payment_method: payment,
      }});
      await clearCart();
      router.replace(`/orders/${order.id}` as any);
    } catch (e: any) { setError(e?.message || "Order place नहीं हुआ।"); } finally { setPlacing(false); }
  };

  if (loading || authLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  const delivery = Number(preview?.delivery_breakdown?.final_delivery_charge || 0);
  const total = preview?.estimated_total ?? subtotal + delivery;

  return <View style={styles.page}><PublicHeader /><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Checkout</Text><Text style={styles.sub}>Delivery details और payment method चुनें।</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.card}><View style={styles.rowHead}><Text style={styles.cardTitle}>Delivery Address</Text><Pressable onPress={() => router.push("/addresses" as any)}><Text style={styles.link}>Manage</Text></Pressable></View>
      {!addresses.length ? <Pressable style={styles.secondary} onPress={() => router.push("/addresses" as any)}><Text style={styles.secondaryText}>+ Add Delivery Address</Text></Pressable> : addresses.map(a => <Pressable key={a.id} onPress={() => setSelected(a.id)} style={[styles.address, selected === a.id && styles.selected]}><View style={styles.radio}>{selected === a.id ? <View style={styles.dot} /> : null}</View><View style={{flex:1}}><Text style={styles.name}>{a.name} • {a.mobile}</Text><Text style={styles.sub}>{a.line1}, {a.city}, {a.state} - {a.pincode}</Text>{a.lat == null || a.lng == null ? <Text style={styles.warn}>GPS coordinates required for delivery calculation</Text> : null}</View></Pressable>)}
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>Payment Method</Text>{(["cod","upi","phonepe"] as const).map(p => <Pressable key={p} onPress={() => setPayment(p)} style={[styles.address, payment === p && styles.selected]}><View style={styles.radio}>{payment === p ? <View style={styles.dot} /> : null}</View><Text style={styles.name}>{p === "cod" ? "Cash on Delivery" : p === "upi" ? "UPI" : "PhonePe"}</Text></Pressable>)}</View>
    <View style={styles.card}><Text style={styles.cardTitle}>Order Summary</Text><View style={styles.line}><Text>Subtotal</Text><Text>{inr(subtotal)}</Text></View><View style={styles.line}><Text>Delivery</Text><Text>{preview ? inr(delivery) : "—"}</Text></View><View style={styles.totalLine}><Text>Total</Text><Text>{inr(total)}</Text></View>{preview?.delivery_breakdown?.reject ? <Text style={styles.error}>यह location serviceable नहीं है।</Text> : null}<Pressable style={styles.primary} onPress={placeOrder} disabled={placing || !!preview?.delivery_breakdown?.reject}>{placing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Place Order • {inr(total)}</Text>}</Pressable></View>
  </ScrollView></View>;
}

const styles = StyleSheet.create({page:{flex:1,backgroundColor:"#FAFAF8"},content:{width:"100%",maxWidth:900,alignSelf:"center",padding:16,paddingBottom:60},title:{fontSize:30,fontWeight:"900",color:theme.colors.text,paddingTop:24},sub:{marginTop:4,color:theme.colors.textMuted,fontSize:13},card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:14,padding:16,marginTop:14,gap:10},cardTitle:{fontSize:17,fontWeight:"900",color:theme.colors.text},rowHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},link:{fontWeight:"800",color:theme.colors.primary},address:{flexDirection:"row",gap:10,alignItems:"center",padding:12,borderWidth:1,borderColor:theme.colors.border,borderRadius:10},selected:{borderColor:theme.colors.primary},radio:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:theme.colors.textSubtle,alignItems:"center",justifyContent:"center"},dot:{width:10,height:10,borderRadius:5,backgroundColor:theme.colors.primary},name:{fontWeight:"800",color:theme.colors.text},warn:{fontSize:11,color:"#9a6700",marginTop:3},line:{flexDirection:"row",justifyContent:"space-between",paddingVertical:5},totalLine:{flexDirection:"row",justifyContent:"space-between",borderTopWidth:1,borderTopColor:theme.colors.border,paddingTop:12,marginTop:6,fontWeight:"900"},primary:{backgroundColor:theme.colors.primary,borderRadius:9,padding:14,alignItems:"center",marginTop:8},primaryText:{color:"#fff",fontWeight:"900"},secondary:{padding:13,alignItems:"center",borderWidth:1,borderColor:theme.colors.border,borderRadius:9},secondaryText:{fontWeight:"800"},error:{backgroundColor:"#fef3f2",color:"#b42318",padding:10,borderRadius:8,marginTop:12},center:{flex:1,alignItems:"center",justifyContent:"center"}});
