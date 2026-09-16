import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { useCart } from "@/src/context/CartContext";
import { inr, theme } from "@/src/theme";

type Product = { id:string; name:string; price:number; mrp?:number; stock?:number; image_base64?:string|null; image_url?:string|null; unit?:string; seller_id?:string; category_id?:string };

export default function Store() {
  const router = useRouter();
  const { addToCart, itemCount } = useCart();
  const [items,setItems] = useState<Product[]>([]);
  const [q,setQ] = useState("");
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await api<{items:Product[];total:number}>("/public/products", { skipAuth:true, query:{q:q || undefined, limit:48} });
      setItems(response.items || []);
    } catch (err:any) {
      setError(err?.message || "Unable to load products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q]);

  useEffect(() => { void load(); }, [load]);

  const refresh = () => { setRefreshing(true); void load(); };
  const productImage = (product:Product) => {
    if (product.image_url) return product.image_url;
    if (!product.image_base64) return undefined;
    if (product.image_base64.startsWith("data:")) return product.image_base64;
    return `data:image/jpeg;base64,${product.image_base64}`;
  };
  const addProduct = (product:Product) => addToCart({ product_id:product.id, name:product.name, price:product.price, mrp:product.mrp, image_base64:product.image_base64, seller_id:product.seller_id, category_id:product.category_id, stock:product.stock, unit:product.unit });

  return <View style={styles.root}>
    <View style={styles.header}>
      <View><Text style={styles.logo}>NEDS SUPER STORE</Text><Text style={styles.sub}>Hyperlocal shopping</Text></View>
      <Pressable onPress={() => router.push("/cart")} style={styles.cart}><Feather name="shopping-cart" size={21} color="#fff"/><Text style={styles.cartCount}>{itemCount}</Text></Pressable>
    </View>
    <View style={styles.search}>
      <Feather name="search" size={18} color={theme.colors.textMuted}/>
      <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => void load()} placeholder="Search products" placeholderTextColor={theme.colors.textSubtle} style={styles.input}/>
      <Pressable onPress={() => void load()}><Text style={styles.searchBtn}>Search</Text></Pressable>
    </View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary}/></View> : error ? <View style={styles.center}><Text style={styles.err}>{error}</Text><Pressable onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View> : <FlatList
      data={items}
      keyExtractor={(product) => product.id}
      numColumns={2}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>} 
      ListEmptyComponent={<View style={styles.center}><Text>No products available yet.</Text></View>}
      renderItem={({item:product}) => {
        const image = productImage(product);
        return <View style={styles.card}>
          {image ? <Image source={{uri:image}} style={styles.pic}/> : <View style={styles.placeholder}><Feather name="package" size={34} color={theme.colors.textSubtle}/></View>}
          <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>{inr(product.price)}{product.unit ? ` / ${product.unit}` : ""}</Text>
          {product.mrp && product.mrp > product.price ? <Text style={styles.mrp}>{inr(product.mrp)}</Text> : null}
          <Pressable onPress={() => addProduct(product)} style={styles.add}><Text style={styles.addText}>ADD TO CART</Text></Pressable>
        </View>;
      }}
    />}
    <Pressable onPress={() => router.push("/signin")} style={styles.signin}><Text style={styles.signinText}>Seller / Rider / Staff / Admin Login</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:"#f7f7f8"},
  header:{backgroundColor:theme.colors.surface,paddingHorizontal:18,paddingTop:18,paddingBottom:14,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  logo:{color:"#fff",fontSize:21,fontWeight:"800",letterSpacing:0.2}, sub:{color:"#a1a1aa",fontSize:12,marginTop:2},
  cart:{flexDirection:"row",alignItems:"center",gap:7}, cartCount:{color:"#fff",fontWeight:"800",backgroundColor:theme.colors.primary,borderRadius:12,minWidth:24,textAlign:"center",paddingVertical:3},
  search:{margin:14,backgroundColor:"#fff",borderWidth:1,borderColor:theme.colors.border,borderRadius:10,paddingHorizontal:12,height:46,flexDirection:"row",alignItems:"center",gap:8},
  input:{flex:1,fontSize:14,color:theme.colors.text,outlineStyle:"none"} as any, searchBtn:{color:theme.colors.primary,fontWeight:"700"},
  grid:{padding:10,paddingBottom:80}, row:{gap:10,marginBottom:10}, card:{backgroundColor:"#fff",borderRadius:10,padding:10,flex:1,maxWidth:"50%",borderWidth:1,borderColor:theme.colors.border},
  pic:{width:"100%",height:145,borderRadius:8,backgroundColor:"#f4f4f5"}, placeholder:{height:145,borderRadius:8,backgroundColor:"#f4f4f5",alignItems:"center",justifyContent:"center"},
  name:{fontSize:14,fontWeight:"600",color:theme.colors.text,marginTop:8,minHeight:38}, price:{fontSize:17,fontWeight:"800",color:theme.colors.primary,marginTop:4}, mrp:{fontSize:12,color:theme.colors.textMuted,textDecorationLine:"line-through"},
  add:{marginTop:9,backgroundColor:theme.colors.primary,borderRadius:7,paddingVertical:9,alignItems:"center"}, addText:{color:"#fff",fontSize:12,fontWeight:"800"},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30}, err:{color:theme.colors.danger,textAlign:"center"}, retry:{marginTop:12,paddingHorizontal:20,paddingVertical:10,backgroundColor:theme.colors.primary,borderRadius:7}, retryText:{color:"#fff",fontWeight:"700"},
  signin:{position:"absolute",bottom:0,left:0,right:0,backgroundColor:"#fff",borderTopWidth:1,borderTopColor:theme.colors.border,padding:13,alignItems:"center"}, signinText:{color:theme.colors.textMuted,fontSize:12,fontWeight:"600"},
});
