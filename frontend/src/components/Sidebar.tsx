import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

const ITEMS: { href: string; label: string; icon: any }[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/admin/orders", label: "Orders", icon: "shopping-bag" },
  { href: "/admin/deliveries", label: "Deliveries", icon: "truck" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/products", label: "Products", icon: "box" },
  { href: "/admin/categories", label: "Categories", icon: "layers" },
  { href: "/admin/payments", label: "Payments", icon: "credit-card" },
  { href: "/admin/rules", label: "Business Rules", icon: "sliders" },
  { href: "/admin/verifications", label: "Delivery Logs", icon: "check-circle" },
  { href: "/admin/audit", label: "Audit Logs", icon: "file-text" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <View style={styles.sidebar} testID="admin-sidebar">
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>NEDS STORE</Text>
          <Text style={styles.brandTag}>Learn • Grow • Succeed</Text>
        </View>
      </View>

      <View style={styles.nav}>
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href as any} asChild>
              <Pressable
                testID={`nav-${item.href.split("/").pop()}`}
                style={({ hovered }) => [
                  styles.navItem,
                  active && styles.navItemActive,
                  hovered && !active && { backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <Feather
                  name={item.icon}
                  size={16}
                  color={active ? theme.colors.primary : "#A1A1AA"}
                />
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                {active ? <View style={styles.activeDot} /> : null}
              </Pressable>
            </Link>
          );
        })}
      </View>

      <View style={styles.userBox}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{(user?.name || "?").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>{user?.name || "—"}</Text>
          <Text style={styles.userRole}>{(user?.role || "").replace(/_/g, " ")}</Text>
        </View>
        <Pressable onPress={logout} testID="logout-button" style={({ hovered }) => [styles.logoutBtn, hovered && { backgroundColor: theme.colors.surfaceMuted }]}>
          <Feather name="log-out" size={16} color="#A1A1AA" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: theme.sidebarWidth,
    height: "100%",
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.borderDark,
    paddingVertical: 20,
    flexDirection: "column",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDark,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
    fontFamily: theme.fonts.heading,
  },
  brandName: {
    color: "#fff",
    fontFamily: theme.fonts.heading,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  brandTag: {
    color: "#71717A",
    fontFamily: theme.fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  nav: {
    flex: 1,
    padding: 12,
    gap: 2,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    // @ts-ignore
    transitionProperty: "background-color",
    transitionDuration: "120ms",
    cursor: "pointer",
  } as any,
  navItemActive: {
    backgroundColor: "rgba(5,150,105,0.14)",
  },
  navText: {
    color: "#D4D4D8",
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  navTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  activeDot: {
    width: 4,
    height: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    position: "absolute",
    left: -12,
  },
  userBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDark,
    paddingTop: 16,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#fff",
    fontFamily: theme.fonts.heading,
    fontWeight: "700",
    fontSize: 14,
  },
  userName: {
    color: "#fff",
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  userRole: {
    color: "#A1A1AA",
    fontFamily: theme.fonts.body,
    fontSize: 11,
    textTransform: "capitalize",
  },
  logoutBtn: {
    padding: 6,
    borderRadius: theme.radius.sm,
    cursor: "pointer" as any,
  },
});
