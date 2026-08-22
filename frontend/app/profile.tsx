import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { PublicHeader } from "@/src/components/PublicHeader";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { theme } from "@/src/theme";

type User = { id: string; mobile: string; name?: string; role?: string; email?: string | null };

export default function ProfilePage() {
  const { user: authUser, loading: authLoading, logout, refresh } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { router.replace("/login" as any); return; }
    api<User>("/customer/profile")
      .then((data) => { setUser(data); setName(data.name || ""); setEmail(data.email || ""); })
      .catch((e: any) => setError(e?.message || "Profile load नहीं हो सका।"))
      .finally(() => setLoading(false));
  }, [authLoading, authUser]);

  const saveProfile = async () => {
    setError(""); setSuccess("");
    if (!name.trim()) return setError("Name खाली नहीं हो सकता।");
    setSaving(true);
    try {
      const data = await api<User>("/customer/profile", { method: "PATCH", body: { name: name.trim(), email: email.trim() || null } });
      setUser(data); setName(data.name || ""); setEmail(data.email || ""); setEditing(false); setSuccess("Profile successfully updated."); await refresh();
    } catch (e: any) { setError(e?.message || "Profile update नहीं हुआ।"); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    setError(""); setSuccess("");
    if (!currentPassword || newPassword.length < 6) return setError("Current password और कम से कम 6 characters का नया password भरें।");
    setChangingPassword(true);
    try {
      await api("/customer/change-password", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } });
      setCurrentPassword(""); setNewPassword(""); setShowPassword(false); setSuccess("Password successfully changed.");
    } catch (e: any) { setError(e?.message || "Password change नहीं हुआ।"); }
    finally { setChangingPassword(false); }
  };

  const doLogout = async () => { await logout(); router.replace("/login" as any); };

  if (authLoading || loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!user) return <View style={styles.center}><Text style={styles.error}>{error || "Profile unavailable"}</Text></View>;

  return <View style={styles.page}><PublicHeader /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.head}><View><Text style={styles.title}>My Profile</Text><Text style={styles.sub}>अपने NEDS STORE account की जानकारी और security manage करें।</Text></View><Pressable onPress={() => { setEditing(v => !v); setError(""); setSuccess(""); }}><Text style={styles.editLink}>{editing ? "Cancel" : "Edit"}</Text></Pressable></View>
    {!!error && <Text style={styles.errorBox}>{error}</Text>}
    {!!success && <Text style={styles.success}>{success}</Text>}

    <View style={styles.card}>
      <Text style={styles.cardTitle}>Account Details</Text>
      {editing ? <>
        <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
        <Text style={styles.label}>Email</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Mobile</Text><Text style={styles.value}>{user.mobile}</Text>
        <Text style={styles.hint}>Mobile number अभी login identity है; इसे profile से बदलने की सुविधा नहीं जोड़ी गई है।</Text>
        <Pressable style={styles.primary} onPress={saveProfile} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save Changes</Text>}</Pressable>
      </> : <>
        <Text style={styles.label}>Name</Text><Text style={styles.value}>{user.name || "Customer"}</Text>
        <Text style={styles.label}>Mobile</Text><Text style={styles.value}>{user.mobile}</Text>
        <Text style={styles.label}>Email</Text><Text style={styles.value}>{user.email || "Not added"}</Text>
        <Text style={styles.label}>Account Type</Text><Text style={styles.value}>{user.role || "customer"}</Text>
      </>}
    </View>

    <View style={styles.card}>
      <View style={styles.rowHead}><Text style={styles.cardTitle}>Password & Security</Text><Pressable onPress={() => { setShowPassword(v => !v); setError(""); setSuccess(""); }}><Text style={styles.editLink}>{showPassword ? "Close" : "Change Password"}</Text></Pressable></View>
      {showPassword ? <>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry />
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password (min 6 characters)" secureTextEntry />
        <Pressable style={styles.primary} onPress={changePassword} disabled={changingPassword}>{changingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Update Password</Text>}</Pressable>
      </> : <Text style={styles.hint}>Your password is stored and verified by the central backend authentication system.</Text>}
    </View>

    <Pressable style={styles.action} onPress={() => router.push("/addresses" as any)}><Text style={styles.actionText}>Manage Addresses</Text></Pressable>
    <Pressable style={styles.action} onPress={() => router.push("/orders" as any)}><Text style={styles.actionText}>My Orders</Text></Pressable>
    <Pressable style={styles.logout} onPress={doLogout}><Text style={styles.logoutText}>Logout</Text></Pressable>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ page:{flex:1,backgroundColor:"#FAFAF8"},content:{width:"100%",maxWidth:900,alignSelf:"center",padding:16,paddingBottom:60},head:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-end",gap:12,paddingTop:22,paddingBottom:8},title:{fontSize:30,fontWeight:"900",color:theme.colors.text},sub:{marginTop:6,color:theme.colors.textMuted},editLink:{fontWeight:"900",color:theme.colors.primary,padding:8},card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:14,padding:18,marginTop:14,gap:9},cardTitle:{fontSize:17,fontWeight:"900",color:theme.colors.text},rowHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},label:{fontSize:12,color:theme.colors.textMuted,marginTop:5},value:{fontSize:16,fontWeight:"800",color:theme.colors.text},input:{borderWidth:1,borderColor:theme.colors.border,borderRadius:9,padding:12,fontSize:15,backgroundColor:"#fff"},hint:{fontSize:11,color:theme.colors.textMuted,lineHeight:17},primary:{backgroundColor:theme.colors.primary,borderRadius:9,padding:13,alignItems:"center",marginTop:5},primaryText:{color:"#fff",fontWeight:"900"},action:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:10,padding:15,marginTop:12},actionText:{fontWeight:"800",color:theme.colors.text},logout:{marginTop:24,alignItems:"center",padding:14},logoutText:{fontWeight:"900",color:theme.colors.danger},errorBox:{marginTop:12,backgroundColor:"#fef3f2",color:"#b42318",padding:10,borderRadius:8},success:{marginTop:12,backgroundColor:"#ecfdf3",color:"#067647",padding:10,borderRadius:8},center:{flex:1,justifyContent:"center",alignItems:"center"},error:{color:theme.colors.danger} });