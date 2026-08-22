import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CartProvider } from "../src/context/CartContext";

export default function Layout() {
  return <SafeAreaView style={{flex:1}}><CartProvider><Stack screenOptions={{headerShown:false}} /></CartProvider></SafeAreaView>;
}
