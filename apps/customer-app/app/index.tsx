import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "../src/api/client";

type Product={id:string;name:string;price:number;image_base64?:string|null};

export default function Home(){
  const [products,setProducts]=useState<Product[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{api<{items:Product[]}>('/public/products',{query:{limit:8}}).then(r=>setProducts(r.items||[])).catch(()=>{}).finally(()=>setLoading(false));},[]);
  return <ScrollView contentContainerStyle={s.page}>
    <View style={s.hero}><Text style={s.brand}>NEDS STORE</Text><Text style={s.title}>आपकी रोज़मर्रा की खरीदारी, अब आसान।</Text><Text style={s.sub}>Nearby products, simple checkout और reliable delivery.</Text><Pressable style={s.primary} onPress={()=>router.push('/products')}><Text style={s.primaryText}>Products देखें</Text></Pressable></View>
    <View style={s.row}><Pressable style={s.tile} onPress={()=>router.push('/orders')}><Text style={s.tileTitle}>मेरे Orders</Text><Text style={s.tileSub}>Track और manage करें</Text></Pressable><Pressable style={s.tile} onPress={()=>router.push('/cart')}><Text style={s.tileTitle}>Cart</Text><Text style={s.tileSub}>आपकी selected items</Text></Pressable></View>
    <Text style={s.section}>Featured Products</Text>{loading?<ActivityIndicator/>:products.length===0?<Text style={s.sub}>अभी products उपलब्ध नहीं हैं।</Text>:products.map(p=><Pressable key={p.id} style={s.product} onPress={()=>router.push({pathname:'/product/[id]',params:{id:p.id}})}><View style={{flex:1}}><Text style={s.productName}>{p.name}</Text><Text style={s.price}>₹{Number(p.price||0).toLocaleString('en-IN')}</Text></View><Text style={s.arrow}>›</Text></Pressable>)}
    <Pressable onPress={()=>router.push('/login')}><Text style={s.login}>Login / Register</Text></Pressable>
  </ScrollView>;
}
const s=StyleSheet.create({page:{padding:18,gap:14,backgroundColor:'#f7f7f5',minHeight:'100%'},hero:{padding:22,borderRadius:18,backgroundColor:'#111',gap:10},brand:{color:'#72ff55',fontSize:16,fontWeight:'800',letterSpacing:1},title:{color:'#fff',fontSize:28,fontWeight:'800'},sub:{color:'#666',fontSize:14},primary:{alignSelf:'flex-start',paddingHorizontal:16,paddingVertical:11,borderRadius:10,backgroundColor:'#72ff55'},primaryText:{fontWeight:'800',color:'#111'},row:{flexDirection:'row',gap:10},tile:{flex:1,padding:16,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5e5e5'},tileTitle:{fontWeight:'800',fontSize:16},tileSub:{fontSize:12,color:'#777',marginTop:4},section:{fontSize:20,fontWeight:'800',marginTop:8},product:{flexDirection:'row',alignItems:'center',padding:15,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5e5e5'},productName:{fontWeight:'700'},price:{fontWeight:'800',marginTop:5},arrow:{fontSize:28,color:'#888'},login:{textAlign:'center',fontWeight:'800',padding:12}});
