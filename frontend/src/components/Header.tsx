import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { usePathname } from "expo-router";

const TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/orders": "Order Management",
  "/admin/deliveries": "Delivery Management",
  "/admin/users": "User Management",
  "/admin/products": "Product Catalog",
  "/admin/categories": "Categories",
  "/admin/payments": "Payments & Refunds",
  "/admin/payment-config": "Payment Configuration",
  "/admin/seller-earnings": "Seller Earnings & Settlements",
  "/admin/rider-earnings": "Rider Earnings & Settlements",
  "/admin/rules": "Business Rules Engine",
  "/admin/verifications": "Delivery Verification Logs",
  "/admin/audit": "Audit Logs",
};

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const title = TITLES[pathname] || "Admin Portal";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <View style={styles.header} testID="admin-header">
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{today}</Text>
      </View>
      <View style={styles.right}>
        <View style={styles.badge}>
          <Feather name="shield" size={12} color={theme.colors.primary} />
          <Text style={styles.badgeText}>{(user?.role || "").replace(/_/g, " ")}</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.mobile}>+91 {user?.mobile}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: theme.headerHeight,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontWeight: "800",
    fontSize: 20,
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  badgeText: {
    fontFamily: theme.fonts.body,
    color: "#065F46",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
  },
  mobile: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
});
