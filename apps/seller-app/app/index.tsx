import React,{useEffect,useState}from"react";
import{ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View}from"react-native";
import{router}from"expo-router";
import{api,clearToken,getToken}from"@/src/api/client";

type User={id:string;mobile:string;role:string;name?:string;shop_name?:string;active?:boolean};

export default function SellerHome(){
 const[user,setUser]=useState<User|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
 useEffect(()=>{(async()=>{try{if(!(await getToken())){router.replace("/login");return;}const me=await api<User>("/auth/me");if(me.role!=="seller")throw new Error("Seller account required");setUser(me);}catch(e:any){setError(e?.message||"Unable to load seller account");}finally{setLoading(false);}})();},[]);
 if(loading)return <View style={s.center}><ActivityIndicator/></View>;
 if(error)return <View style={s.center}><Text style={s.error}>{error}</Text><Pressable style={s.button} onPress={()=>router.replace("/login")}><Text style={s.buttonText}>Login</Text></Pressable></View>;
 return <ScrollView contentContainerStyle={s.container}><Text style={s.brand}>NEDS STORE</Text><Text style={s.title}>Seller Dashboard</Text><Text style={s.sub}>{user?.shop_name||user?.name||user?.mobile}</Text>
  <View style={s.grid}><Card title="Orders" text="Manage new, accepted and preparation orders"/><Card title="Products" text="Add, edit and manage shop products"/><Card title="Inventory" text="Stock and low-stock management"/><Card title="Earnings" text="Commission and settlement summary"/></View>
  <Text style={s.note}>Seller-specific backend workflows are integrated only where verified in the shared API. Local/device QA is pending.</Text>
  <Pressable style={s.outline} onPress={async()=>{await clearToken();router.replace("/login")}}><Text style={s.outlineText}>Logout</Text></Pressable>
 </ScrollView>;
}
function Card({title,text}:{title:string;text:string}){return <View style={s.card}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardText}>{text}</Text></View>}
const s=StyleSheet.create({container:{padding:24,paddingTop:60,gap:12,backgroundColor:"#fafaf8",minHeight:"100%"},brand:{fontSize:14,fontWeight:"900"},title:{fontSize:30,fontWeight:"900"},sub:{color:"#666"},grid:{gap:10,marginTop:12},card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#ddd",borderRadius:14,padding:18},cardTitle:{fontSize:18,fontWeight:"900"},cardText:{color:"#666",marginTop:4},note:{marginTop:12,color:"#8a6500",fontSize:12},outline:{borderWidth:1,borderColor:"#222",padding:13,borderRadius:10,alignItems:"center",marginTop:10},outlineText:{fontWeight:"900"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:24},error:{color:"#b42318",textAlign:"center",marginBottom:12},button:{backgroundColor:"#111",padding:13,borderRadius:9},buttonText:{color:"#fff",fontWeight:"900"}});
