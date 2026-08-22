import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { useAuth, isAdminRole } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

export default function AdminLogin() {
  const { login, logout, user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});

  useEffect(() => {
    if (!loading && user) router.replace(isAdminRole(user.role) ? "/admin/dashboard" : "/");
  }, [user, loading, router]);

  const handleLogin = async () => {
    const e: typeof errors = {};
    if (!/^\d{10}$/.test(mobile)) e.mobile = "Enter a valid 10-digit mobile number";
    if (password.length < 4) e.password = "Password required";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const u = await login(mobile, password);
      if (!isAdminRole(u.role)) {
        await logout();
        toast.error("This account does not have Admin Portal access");
        return;
      }
      toast.success(`Welcome, ${u.name}`);
      router.replace("/admin/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const isDesktop = width >= 900;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={[styles.container, !isDesktop && { flexDirection: "column" }]} testID="admin-login-screen">
        {isDesktop && <View style={styles.brandPane}><View style={styles.brandInner}>
          <View style={styles.logoBox}><Text style={styles.logoLetter}>N</Text></View>
          <Text style={styles.brandTitle}>NEDS STORE</Text><Text style={styles.brandSubtitle}>Next Era Digital Solutions</Text>
          <Text style={styles.brandTagline}>ADMIN PORTAL</Text>
          <View style={styles.brandFeatures}>{["Enterprise-grade RBAC","Hyperlocal delivery orchestration","Live business rules engine","Live rider monitoring on Google Maps"].map((label,i)=><View key={label} style={styles.featureRow}><Feather name={["shield","truck","activity","map-pin"][i] as any} size={16} color={theme.colors.primary}/><Text style={styles.featureLabel}>{label}</Text></View>)}</View>
        </View></View>}
        <ScrollView style={styles.formPane} contentContainerStyle={styles.formPaneContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard} testID="admin-login-form">
            {!isDesktop && <View style={{alignItems:"center",marginBottom:24}}><View style={styles.logoBoxSm}><Text style={styles.logoLetterSm}>N</Text></View><Text style={styles.brandTitleSm}>NEDS STORE</Text></View>}
            <Text style={styles.title}>Admin Portal Login</Text><Text style={styles.subtitle}>Sign in with an authorized administrator account</Text>
            <View style={{gap:16,marginTop:24}}>
              <Input label="Mobile Number" testID="admin-login-mobile-input" value={mobile} onChangeText={v=>setMobile(v.replace(/\D/g,"").slice(0,10))} placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} error={errors.mobile}/>
              <Input label="Password" testID="admin-login-password-input" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry error={errors.password} onSubmitEditing={handleLogin}/>
              <Button title={submitting?"Signing in…":"Sign In"} onPress={handleLogin} loading={submitting} fullWidth testID="admin-login-submit-button"/>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles=StyleSheet.create({
 container:{flex:1,flexDirection:"row",backgroundColor:"#fff"},brandPane:{width:"42%",backgroundColor:theme.colors.surface,padding:48,justifyContent:"center"},brandInner:{maxWidth:480,gap:12},logoBox:{width:56,height:56,borderRadius:12,backgroundColor:theme.colors.primary,alignItems:"center",justifyContent:"center"},logoLetter:{color:"#fff",fontSize:28,fontWeight:"800"},brandTitle:{color:"#fff",fontSize:36,fontWeight:"800"},brandSubtitle:{color:"#A1A1AA",fontSize:14},brandTagline:{color:theme.colors.primary,fontSize:13,fontWeight:"700",letterSpacing:1,marginTop:4,marginBottom:32},brandFeatures:{gap:14},featureRow:{flexDirection:"row",alignItems:"center",gap:12},featureLabel:{color:"#D4D4D8",fontSize:14},formPane:{flex:1,backgroundColor:theme.colors.bg},formPaneContent:{flexGrow:1,alignItems:"center",justifyContent:"center",padding:32},formCard:{width:"100%",maxWidth:420},logoBoxSm:{width:48,height:48,borderRadius:10,backgroundColor:theme.colors.primary,alignItems:"center",justifyContent:"center",marginBottom:12},logoLetterSm:{color:"#fff",fontSize:24,fontWeight:"800"},brandTitleSm:{fontSize:22,fontWeight:"800",color:theme.colors.text},title:{fontSize:24,fontWeight:"700",color:theme.colors.text},subtitle:{color:theme.colors.textMuted,fontSize:14,marginTop:4}
});
