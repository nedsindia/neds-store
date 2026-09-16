import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth, isAdminRole } from "@/src/context/AuthContext";
import { theme } from "@/src/theme";
export default function Index(){const{user,loading}=useAuth();const router=useRouter();useEffect(()=>{if(loading)return;if(user&&isAdminRole(user.role))router.replace("/admin/dashboard");else if(user)router.replace("/role-home");else router.replace("/store")},[loading,user,router]);return <View style={s.container}><ActivityIndicator color={theme.colors.primary} size="large"/></View>}
const s=StyleSheet.create({container:{flex:1,backgroundColor:"#fff",alignItems:"center",justifyContent:"center"}});
