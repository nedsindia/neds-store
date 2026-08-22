import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { api, clearToken } from "@/src/api/client";
import { PublicHeader } from "@/src/components/PublicHeader";
import { theme } from "@/src/theme";

type User = { id: string; mobile: string; name?: string; role?: string; email?: string };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch((e: any) => {
      setError(e?.message || "Profile load नहीं हो सका।");
      router.replace("/login" as any);
    }).finally(() => setLoading(false));
  }, []);

  const logout = async () => { await clearToken(); router.replace("/login" as any); };

  return <View style={styles.page}><PublicHeader /><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>My Profile</Text><Text style={styles.sub}>अपने NEDS STORE account की जानकारी और quick actions manage करें।</Text>
    {loading ? <ActivityIndicator style={{ marginTop: 30 }} /> : error ? <Text style={styles.error}>{error}</Text> : user && <>
      <View style={styles.card}><Text style={styles.label}>Name</Text><Text style={styles.value}>{user.name || "Customer"}</Text><Text style={styles.label}>Mobile</Text><Text style={styles.value}>{user.mobile}</Text>{user.email ? <><Text style={styles.label}>Email</Text><Text style={styles.value}>{user.email}</Text></> : null}<Text style={styles.label}>Account Type</Text><Text style={styles.value}>{user.role || "customer"}</Text></View>
      <Pressable style={styles.action} onPress={() => router.push("/addresses" as any)}><Text style={styles.actionText}>Manage Addresses</Text></Pressable>
      <Pressable style={styles.action} onPress={() => router.push("/orders" as any)}><Text style={styles.actionText}>My Orders</Text></Pressable>
      <Pressable style={styles.logout} onPress={logout}><Text style={styles.logoutText}>Logout</Text></Pressable>
    </>}
  </ScrollView></View>;
}

const styles = StyleSheet.create({page:{flex:1,backgroundColor:"#FAFAF8"},content:{width:"100%",maxWidth:900,alignSelf:"center",padding:16,paddingBottom:60},title:{fontSize:30,fontWeight:"900",color:theme.colors.text,marginTop:22},sub:{marginTop:6,color:theme.colors.textMuted},card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:14,padding:18,marginTop:22,gap:7},label:{fontSize:12,color:theme.colors.textMuted,marginTop:7},value:{fontSize:16,fontWeight:"800",color:theme.colors.text},action:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:10,padding:15,marginTop:12},actionText:{fontWeight:"800",color:theme.colors.text},logout:{marginTop:24,alignItems:"center",padding:14},logoutText:{fontWeight:"900",color:theme.colors.danger},error:{marginTop:24,color:theme.colors.danger}});