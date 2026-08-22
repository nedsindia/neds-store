import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PublicHeader } from "@/src/components/PublicHeader";
import { api } from "@/src/api/client";
import { theme, inr } from "@/src/theme";

type Order = { id: string; status: string; total: number; subtotal: number; delivery_charge: number; created_at: string };
export default function OrdersPage() {
  const [items, setItems] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { api<{items:Order[]}>("/customer/orders").then(r => setItems(r.items || [])).catch((e:any) => setError(e?.message || "Orders load नहीं हुए।")).finally(() => setLoading(false)); }, []);
  return <View style={styles.page}><PublicHeader/><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>My Orders</Text>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator/> : items.length ? items.map(o => <Pressable key={o.id} onPress={() => router.push(`/orders/${o.id}` as any)} style={styles.card}><View style={styles.row}><Text style={styles.id}>Order #{o.id.slice(0,8)}</Text><Text style={styles.status}>{o.status}</Text></View><Text style={styles.sub}>{new Date(o.created_at).toLocaleString()}</Text><Text style={styles.total}>{inr(o.total)}</Text></Pressable>) : <View style={styles.empty}><Text style={styles.id}>No orders yet</Text><Text style={styles.sub}>आपके orders यहाँ दिखाई देंगे।</Text></View>}</ScrollView></View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:"#FAFAF8"},content:{width:"100%",maxWidth:900,alignSelf:"center",padding:16,paddingBottom:60},title:{fontSize:30,fontWeight:"900",color:theme.colors.text,paddingTop:24,paddingBottom:16},card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:14,padding:16,marginBottom:10,gap:7},row:{flexDirection:"row",justifyContent:"space-between",gap:10},id:{fontWeight:"900",color:theme.colors.text},status:{fontWeight:"800",textTransform:"capitalize"},sub:{fontSize:12,color:theme.colors.textMuted},total:{fontSize:18,fontWeight:"900",color:theme.colors.text},empty:{backgroundColor:"#fff",padding:30,alignItems:"center",borderRadius:14},error:{color:"#b42318",padding:10}});
