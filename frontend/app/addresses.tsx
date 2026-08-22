import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/src/api/client";
import { PublicHeader } from "@/src/components/PublicHeader";
import { useAuth } from "@/src/context/AuthContext";
import { theme } from "@/src/theme";

type Address = { id: string; label: string; name: string; mobile: string; line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; lat?: number | null; lng?: number | null; is_default?: boolean };
type FormState = { label: string; name: string; mobile: string; line1: string; city: string; state: string; pincode: string; lat: string; lng: string };
const EMPTY_FORM: FormState = { label: "Home", name: "", mobile: "", line1: "", city: "", state: "", pincode: "", lat: "", lng: "" };

export default function AddressesPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = async () => {
    try {
      const r = await api<{ items: Address[] }>("/customer/addresses");
      setItems(r.items || []);
    } catch (e: any) {
      setError(e?.message || "Addresses load नहीं हो सके।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    load();
  }, [authLoading, user]);

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const startEdit = (address: Address) => {
    setEditingId(address.id);
    setForm({ label: address.label || "Home", name: address.name || "", mobile: address.mobile || "", line1: address.line1 || "", city: address.city || "", state: address.state || "", pincode: address.pincode || "", lat: address.lat == null ? "" : String(address.lat), lng: address.lng == null ? "" : String(address.lng) });
    setError("");
    setShowForm(true);
  };

  const captureLocation = () => {
    setError("");
    if (Platform.OS !== "web" || typeof navigator === "undefined" || !navigator.geolocation) {
      setError("इस browser में GPS location उपलब्ध नहीं है। Latitude और longitude manually भर सकते हैं।");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({ ...current, lat: coords.latitude.toFixed(6), lng: coords.longitude.toFixed(6) }));
        setLocationLoading(false);
      },
      (geoError) => {
        setLocationLoading(false);
        setError(geoError.code === 1 ? "Location permission denied. Browser settings से permission दें और फिर कोशिश करें।" : "Current location नहीं मिल सकी। फिर से कोशिश करें या coordinates manually भरें।");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const save = async () => {
    setError("");
    if (!form.name || !/^\d{10}$/.test(form.mobile) || !form.line1 || !form.city || !form.state || !/^\d{6}$/.test(form.pincode)) {
      setError("सभी जरूरी address details सही भरें।");
      return;
    }
    if (form.lat && Number.isNaN(Number(form.lat))) return setError("Latitude सही भरें।");
    if (form.lng && Number.isNaN(Number(form.lng))) return setError("Longitude सही भरें।");
    setSaving(true);
    try {
      const body = { label: form.label || "Home", name: form.name, mobile: form.mobile, line1: form.line1, city: form.city, state: form.state, pincode: form.pincode, lat: form.lat ? Number(form.lat) : null, lng: form.lng ? Number(form.lng) : null, is_default: editingId ? undefined : items.length === 0 };
      if (editingId) await api(`/customer/addresses/${editingId}`, { method: "PATCH", body });
      else await api("/customer/addresses", { method: "POST", body });
      setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); await load();
    } catch (e: any) {
      setError(e?.message || "Address save नहीं हुआ।");
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (id: string) => {
    try { await api(`/customer/addresses/${id}`, { method: "PATCH", body: { is_default: true } }); await load(); }
    catch (e: any) { setError(e?.message || "Default address update नहीं हुआ।"); }
  };

  const del = async (id: string) => {
    try { await api(`/customer/addresses/${id}`, { method: "DELETE" }); await load(); }
    catch (e: any) { setError(e?.message || "Address delete नहीं हुआ।"); }
  };

  if (authLoading || !user) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return <View style={styles.page}><PublicHeader /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.head}><View><Text style={styles.title}>My Addresses</Text><Text style={styles.sub}>Checkout के लिए delivery address manage करें।</Text></View><Pressable style={styles.primary} onPress={showForm ? () => { setShowForm(false); setEditingId(null); } : startAdd}><Text style={styles.primaryText}>{showForm ? "Close" : "+ Add Address"}</Text></Pressable></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {showForm && <View style={styles.card}>
      <Text style={styles.cardTitle}>{editingId ? "Edit Address" : "New Address"}</Text>
      {[["label","Label"],["name","Name"],["mobile","Mobile"],["line1","Address line"],["city","City"],["state","State"],["pincode","Pincode"],["lat","Latitude"],["lng","Longitude"]].map(([k,p]) => <TextInput key={k} style={styles.input} placeholder={p} value={(form as any)[k]} onChangeText={v => setForm(x => ({ ...x, [k]: v }))} keyboardType={k === "mobile" || k === "pincode" || k === "lat" || k === "lng" ? "numeric" : "default"} />)}
      <Pressable style={styles.locationBtn} onPress={captureLocation} disabled={locationLoading}>{locationLoading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.locationText}>Use My Current Location</Text>}</Pressable>
      <Text style={styles.hint}>GPS coordinates delivery-zone और delivery-charge calculation के लिए इस्तेमाल होंगे।</Text>
      <Pressable style={styles.primary} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{editingId ? "Update Address" : "Save Address"}</Text>}</Pressable>
    </View>}
    {loading ? <ActivityIndicator color={theme.colors.primary} /> : items.length ? items.map(a => <View key={a.id} style={styles.card}>
      <View style={styles.row}><Text style={styles.cardTitle}>{a.label}{a.is_default ? " • Default" : ""}</Text><View style={styles.actions}><Pressable onPress={() => startEdit(a)}><Text style={styles.edit}>Edit</Text></Pressable><Pressable onPress={() => del(a.id)}><Text style={styles.delete}>Delete</Text></Pressable></View></View>
      <Text style={styles.name}>{a.name} • {a.mobile}</Text><Text style={styles.sub}>{a.line1}, {a.city}, {a.state} - {a.pincode}</Text>{a.lat != null && a.lng != null ? <Text style={styles.coords}>GPS: {a.lat}, {a.lng}</Text> : <Text style={styles.warn}>GPS coordinates not saved</Text>}
      {!a.is_default ? <Pressable onPress={() => makeDefault(a.id)}><Text style={styles.defaultLink}>Make Default</Text></Pressable> : null}
    </View>) : <View style={styles.empty}><Text style={styles.cardTitle}>No addresses yet</Text><Text style={styles.sub}>पहला delivery address जोड़ें।</Text></View>}
    <Pressable onPress={() => router.push("/checkout" as any)} style={styles.secondary}><Text style={styles.secondaryText}>Go to Checkout</Text></Pressable>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ page:{flex:1,backgroundColor:"#FAFAF8"},content:{width:"100%",maxWidth:900,alignSelf:"center",padding:16,paddingBottom:60},head:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12,paddingVertical:24},title:{fontSize:28,fontWeight:"900",color:theme.colors.text},sub:{marginTop:4,color:theme.colors.textMuted,fontSize:13},card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:14,padding:16,marginBottom:12,gap:9},cardTitle:{fontSize:17,fontWeight:"900",color:theme.colors.text},input:{borderWidth:1,borderColor:theme.colors.border,borderRadius:9,padding:12,fontSize:15,backgroundColor:"#fff"},primary:{backgroundColor:theme.colors.primary,paddingHorizontal:15,paddingVertical:11,borderRadius:9,alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"800"},row:{flexDirection:"row",justifyContent:"space-between",gap:12},actions:{flexDirection:"row",gap:14},name:{fontWeight:"700",color:theme.colors.text},edit:{color:theme.colors.primary,fontWeight:"800"},delete:{color:theme.colors.danger,fontWeight:"800"},defaultLink:{color:theme.colors.primary,fontWeight:"800",marginTop:3},coords:{fontSize:12,color:theme.colors.textSubtle},warn:{fontSize:12,color:"#9a6700"},hint:{fontSize:11,color:theme.colors.textMuted,lineHeight:16},locationBtn:{borderWidth:1,borderColor:theme.colors.primary,borderRadius:9,padding:12,alignItems:"center"},locationText:{fontWeight:"800",color:theme.colors.primary},error:{backgroundColor:"#fef3f2",color:"#b42318",padding:10,borderRadius:8,marginBottom:12},empty:{padding:30,alignItems:"center",backgroundColor:"#fff",borderRadius:14,marginBottom:12},secondary:{alignItems:"center",padding:14},secondaryText:{fontWeight:"800",color:theme.colors.text},center:{flex:1,alignItems:"center",justifyContent:"center"} });