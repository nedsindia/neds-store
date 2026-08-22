import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { PublicHeader } from "@/src/components/PublicHeader";
import { api } from "@/src/api/client";
import { theme, inr } from "@/src/theme";

export default function OrderDetailPage() {
  const { id } = useLocalSearchParams<{id:string}>(); const [data,setData]=useState<any>(null); const [error,setError]=useState("");
  useEffect(()=>{ if(id) api(`/customer/orders/${id}`).then(setData).catch((e:any)=>setError(e?.message||"Order load नहीं हुआ।")); },[id]);
  if(error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if(!data) return <View style={styles.center}><ActivityIndicator/></View>;
  const o=data.order;
  return <View style={styles.page}><PublicHeader/><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Order #{String(o.id).slice(0,8)}</Text><View style={styles.card}><Text style={styles.status}>{o.status}</Text><Text style={styles.sub}>Payment: {o.payment_method}</Text><Text style={styles.sub}>Delivery: {o.delivery_address}</Text></View><View style={styles.card}><Text style={styles.cardTitle}>Items</Text>{(o.items||[]).map((i:any)=><View key={i.product_id} style={styles.row}><Text style={styles.sub}>{i.name} × {i.qty}</Text><Text>{inr(i.price*i.qty)}</Text></View>)}<View style={styles.totalRow}><Text style={styles.cardTitle}>Total</Text><Text style={styles.total}>{inr(o.total)}</Text></View></View><View style={styles.card}><Text style={styles.cardTitle}>Delivery Status</Text><Text style={styles.sub}>{data.delivery?.status || "Waiting for assignment"}</Text>{data.delivery?.rider_name ? <Text style={styles.sub}>Rider: {data.delivery.rider_name}</Text> : null}</View>{data.invoice ? <View style={styles.card}><Text style={styles.cardTitle}>Invoice</Text><Text style={styles.sub}>{data.invoice.invoice_number} • {inr(data.invoice.grand_total)}</Text></View>:null}</ScrollView></View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:"#FAFAF8"},content:{width:"100%",maxWidth:900,alignSelf:"center",padding:16,paddingBottom:60},title:{fontSize:30,fontWeight:"900",color:theme.colors.text,paddingTop:24,paddingBottom:14},card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:14,padding:16,marginBottom:12,gap:9},cardTitle:{fontSize:16,fontWeight:"900",color:theme.colors.text},status:{fontWeight:"900",textTransform:"capitalize"},sub:{fontSize:13,color:theme.colors.textMuted},row:{flexDirection:"row",justifyContent:"space-between",gap:10,paddingVertical:6},totalRow:{flexDirection:"row",justifyContent:"space-between",borderTopWidth:1,borderTopColor:theme.colors.border,paddingTop:12,marginTop:8},total:{fontSize:18,fontWeight:"900"},center:{flex:1,justifyContent:"center",alignItems:"center"},error:{color:"#b42318"}});
