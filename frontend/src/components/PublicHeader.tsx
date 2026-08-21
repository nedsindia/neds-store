import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { useCart } from "@/src/context/CartContext";
import { theme } from "@/src/theme";

type Props = {
  onSearch?: (q: string) => void;
  initialQuery?: string;
  showSearch?: boolean;
};

export function PublicHeader({ onSearch, initialQuery = "", showSearch = true }: Props) {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [menu, setMenu] = useState(false);

  const submit = () => {
    if (onSearch) return onSearch(q);
    if (q.trim()) router.push({ pathname: "/search", params: { q: q.trim() } } as any);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Link href="/" asChild>
          <Pressable style={styles.brandBtn}>
            <View style={styles.logoBox}><Text style={styles.logoTxt}>N</Text></View>
            <View>
              <Text style={styles.brand}>NEDS STORE</Text>
              <Text style={styles.tagline}>Learn • Grow • Succeed</Text>
            </View>
          </Pressable>
        </Link>

        {showSearch ? (
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={theme.colors.textMuted} />
            <input
              value={q}
              onChange={(e: any) => setQ(e.target.value)}
              onKeyDown={(e: any) => { if (e.key === "Enter") submit(); }}
              placeholder="Search products, categories..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", padding: 8, fontFamily: theme.fonts.body } as any}
            />
            <Pressable style={styles.searchBtn} onPress={submit}>
              <Text style={styles.searchBtnTxt}>Search</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Link href="/orders" asChild>
            <Pressable style={styles.iconBtn}>
              <Feather name="package" size={20} color={theme.colors.text} />
              <Text style={styles.iconLabel}>Orders</Text>
            </Pressable>
          </Link>
          <Link href="/cart" asChild>
            <Pressable style={styles.iconBtn}>
              <View>
                <Feather name="shopping-cart" size={20} color={theme.colors.text} />
                {itemCount > 0 ? (
                  <View style={styles.badge}><Text style={styles.badgeTxt}>{itemCount}</Text></View>
                ) : null}
              </View>
              <Text style={styles.iconLabel}>Cart</Text>
            </Pressable>
          </Link>
          {user ? (
            <Pressable style={styles.iconBtn} onPress={() => setMenu((m) => !m)}>
              <Feather name="user" size={20} color={theme.colors.text} />
              <Text style={styles.iconLabel} numberOfLines={1}>{user.name?.split(" ")[0] || "Account"}</Text>
            </Pressable>
          ) : (
            <Link href="/login" asChild>
              <Pressable style={styles.loginBtn}>
                <Text style={styles.loginBtnTxt}>Login / Sign up</Text>
              </Pressable>
            </Link>
          )}
        </View>
      </View>

      {menu && user ? (
        <View style={styles.menu}>
          <Link href="/profile" asChild>
            <Pressable style={styles.menuItem} onPress={() => setMenu(false)}><Feather name="user" size={14} color={theme.colors.text} /><Text style={styles.menuTxt}>My Profile</Text></Pressable>
          </Link>
          <Link href="/orders" asChild>
            <Pressable style={styles.menuItem} onPress={() => setMenu(false)}><Feather name="package" size={14} color={theme.colors.text} /><Text style={styles.menuTxt}>My Orders</Text></Pressable>
          </Link>
          <Link href="/help" asChild>
            <Pressable style={styles.menuItem} onPress={() => setMenu(false)}><Feather name="help-circle" size={14} color={theme.colors.text} /><Text style={styles.menuTxt}>Help & Support</Text></Pressable>
          </Link>
          <Pressable style={styles.menuItem} onPress={async () => { setMenu(false); await logout(); router.replace("/" as any); }}>
            <Feather name="log-out" size={14} color="#EF4444" />
            <Text style={[styles.menuTxt, { color: "#EF4444" }]}>Logout</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderBottomWidth: 1, borderColor: theme.colors.border, zIndex: 20 },
  bar: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 1400, alignSelf: "center", width: "100%" },
  brandBtn: { flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" as any },
  logoBox: { width: 36, height: 36, backgroundColor: theme.colors.primary, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logoTxt: { color: "#fff", fontFamily: theme.fonts.heading, fontSize: 20, fontWeight: "700" },
  brand: { fontFamily: theme.fonts.heading, fontSize: 16, fontWeight: "800", color: theme.colors.text, letterSpacing: 0.5 },
  tagline: { fontFamily: theme.fonts.body, fontSize: 9, color: theme.colors.primary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F4F4F5", borderRadius: 8, paddingHorizontal: 12, maxWidth: 640 },
  searchBtn: { backgroundColor: theme.colors.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, cursor: "pointer" as any },
  searchBtnTxt: { color: "#fff", fontFamily: theme.fonts.body, fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, cursor: "pointer" as any },
  iconLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, fontWeight: "500", maxWidth: 90 },
  badge: { position: "absolute", top: -6, right: -8, backgroundColor: theme.colors.primary, borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700", fontFamily: theme.fonts.body },
  loginBtn: { backgroundColor: theme.colors.text, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 6, cursor: "pointer" as any },
  loginBtnTxt: { color: "#fff", fontFamily: theme.fonts.body, fontSize: 13, fontWeight: "600" },
  menu: { position: "absolute", top: "100%", right: 16, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, padding: 8, gap: 2, minWidth: 200, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, zIndex: 100 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 6, cursor: "pointer" as any },
  menuTxt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
});
