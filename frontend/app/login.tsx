import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { useAuth, isAdminRole } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

export default function CustomerLogin() {
  const { login, logout, user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{mobile?:string;password?:string}>({});

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
      if (isAdminRole(u.role) || u.role !== "customer") {
        await logout();
        toast.error("This login is for customer accounts only");
        return;
      }
      toast.success(`Welcome, ${u.name}`);
      router.replace("/");
    } catch (err:any) { toast.error(err.message || "Login failed"); }
    finally { setSubmitting(false); }
  };

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex:1}}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.card} testID="customer-login-form">
        <View style={styles.logo}><Text style={styles.logoText}>N</Text></View>
        <Text style={styles.brand}>NEDS STORE</Text>
        <Text style={styles.title}>Customer Login</Text>
        <Text style={styles.subtitle}>Sign in to shop, track orders and manage your account</Text>
        <View style={{gap:16,marginTop:24}}>
          <Input label="Mobile Number" testID="customer-login-mobile-input" value={mobile} onChangeText={v=>setMobile(v.replace(/\D/g,"").slice(0,10))} placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} error={errors.mobile}/>
          <Input label="Password" testID="customer-login-password-input" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry error={errors.password} onSubmitEditing={handleLogin}/>
          <Button title={submitting?"Signing in…":"Sign In"} onPress={handleLogin} loading={submitting} fullWidth testID="customer-login-submit-button"/>
        </View>
        <Text style={styles.note}>New customer registration will be available from the customer account flow.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles=StyleSheet.create({page:{flexGrow:1,alignItems:"center",justifyContent:"center",padding:24,backgroundColor:theme.colors.bg},card:{width:"100%",maxWidth:440,padding:32,borderRadius:16,backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border},logo:{width:52,height:52,borderRadius:12,backgroundColor:theme.colors.primary,alignItems:"center",justifyContent:"center",marginBottom:12},logoText:{color:"#fff",fontSize:26,fontWeight:"800"},brand:{fontSize:20,fontWeight:"800",color:theme.colors.text},title:{fontSize:28,fontWeight:"700",color:theme.colors.text,marginTop:28},subtitle:{fontSize:14,color:theme.colors.textMuted,marginTop:6,lineHeight:21},note:{fontSize:12,color:theme.colors.textMuted,marginTop:20,lineHeight:18}});
