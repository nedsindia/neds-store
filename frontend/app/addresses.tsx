import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/src/api/client";
import { PublicHeader } from "@/src/components/PublicHeader";
import { theme } from "@/src/theme";

type Address = { id: string; label: string; name: string; mobile: string; line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; lat?: number | null; lng?: number | null; is_default?: boolean };

export default function AddressesPage() {
  const [items, setItems] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", mobile: "", line1: "", city: "", state: "", pincode: "", lat: "", lng: "" });

  const load = async () => { try { const r = await api<{ items: Address[] }>("/customer/addresses"); setItems(r.items || []); } catch (e: any) { setError(e?.message || "Addresses load नहीं हो सके।"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setError("");
    if (!form.name || !/^\d{10}$/.test(form.mobile) || !form.line1 || !form.city || !form.state || !/^\d{6}$/.test(form.pincode)) return setError("सभी जरूरी address details सही भरें।");
    setSaving(true);
    try {
      await api("/customer/addresses", { method: "POST", body: { label: "Home", name: form.name, mobile: form.mobile, line1: form.line1, city: form.city, state: form.state, pincode: form.pincode, lat: form.lat ? Number(form.lat) : null, lng: form.lng ? Number(form.lng) : null, is_default: items.length === 0 } });
      setForm({ name: "", mobile: "", line1: "", city: "", state: "", pincode: "", lat: "", lng: "" }); setShowForm(false); await load();
    } catch (e: any) { setError(e?.message || "Address save नहीं हुआ।"); } finally { setSaving(false); }
  };

  const del = async (id: string) => { try { await api(`/customer/addresses/${id}`, { method: "DELETE" }); await load(); } catch (e: any) { setError(e?.message || "Address delete नहीं हुआ।"); } };

  return <View style={styles.page}><PublicHeader /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.head}><View><Text style={styles.title}>My Addresses</Text><Text style={styles.sub}>Checkout के लिए delivery address manage करें।</Text></View><Pressable style={styles.primary} onPress={() => setShowForm(v => !v)}><Text style={styles.primaryText}>{showForm ? "Close" : "+ Add Address"}</Text></Pressable></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {showForm && <View style={styles.card}><Text style={styles.cardTitle}>New Address</Text>{[["name","Name"],["mobile","Mobile"],["line1","Address line"],["city","City"],["state","State"],["pincode","Pincode"],["lat","Latitude (required for delivery calculation)"],["lng","Longitude (required for delivery calculation)"]].map(([k,p]) => <TextInput key={k} style={styles.input} placeholder={p} value={(form as any)[k]} onChangeText={v => setForm(x => ({ ...x, [k]: v }))} keyboardType={k === "mobile" || k === "pincode" || k === "lat" || k === "lng" ? "numeric" : "default"} />)}<Pressable style={styles.primary} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save Address</Text>}</Pressable></View>}
    {loading ? <ActivityIndicator /> : items.length ? items.map(a => <View key={a.id} style={styles.card}><View style={styles.row}><Text style={styles.cardTitle}>{a.label}{a.is_default ? " • Default" : ""}</Text><Pressable onPress={() => del(a.id)}><Text style={styles.delete}>Delete</Text></Pressable></View><Text style={styles.name}>{a.name} • {a.mobile}</Text><Text style={styles.sub}>{a.line1}, {a.city}, {a.state} - {a.pincode}</Text>{a.lat != null && a.lng != null ? <Text style={styles.coords}>GPS: {a.lat}, {a.lng}</Text> : <Text style={styles.warn}>GPS coordinates not saved</Text>}</View>) : <View style={styles.empty}><Text style={styles.cardTitle}>No addresses yet</Text><Text style={styles.sub}>पहला delivery address जोड़ें।</Text></View>}
    <Pressable onPress={() => router.push("/checkout" as any)} style={styles.secondary}><Text style={styles.secondaryText}>Go to Checkout</Text></Pressable>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ page:{flex:1,backgroundColor:"#FAFAF8"},content:{width:"100%",maxWidth:900,alignSelf:"center",padding:16,paddingBottom:60},head:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12,paddingVertical:24},title:{fontSize:28,fontWeight:"900",color:theme.colors.text},sub:{marginTop:4,color:theme.colors.textMuted,fontSize:13},card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:14,padding:16,marginBottom:12,gap:9},cardTitle:{fontSize:17,fontWeight:"900",color:theme.colors.text},input:{borderWidth:1,borderColor:theme.colors.border,borderRadius:9,padding:12,fontSize:15,backgroundColor:"#fff"},primary:{backgroundColor:theme.colors.primary,paddingHorizontal:15,paddingVertical:11,borderRadius:9,alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"800"},row:{flexDirection:"row",justifyContent:"space-between",gap:12},name:{fontWeight:"700",color:theme.colors.text},delete:{color:theme.colors.danger,fontWeight:"800"},coords:{fontSize:12,color:theme.colors.textSubtle},warn:{fontSize:12,color:"#9a6700"},error:{backgroundColor:"#fef3f2",color:"#b42318",padding:10,borderRadius:8,marginBottom:12},empty:{padding:30,alignItems:"center",backgroundColor:"#fff",borderRadius:14,marginBottom:12},secondary:{alignItems:"center",padding:14},secondaryText:{fontWeight:"800",color:theme.colors.text}});
