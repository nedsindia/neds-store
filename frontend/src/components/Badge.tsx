import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/src/theme";

const VARIANTS: Record<string, { bg: string; fg: string; border: string }> = {
  success: { bg: "#D1FAE5", fg: "#065F46", border: "#A7F3D0" },
  active: { bg: "#D1FAE5", fg: "#065F46", border: "#A7F3D0" },
  delivered: { bg: "#D1FAE5", fg: "#065F46", border: "#A7F3D0" },
  paid: { bg: "#D1FAE5", fg: "#065F46", border: "#A7F3D0" },

  warning: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" },
  pending: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" },
  placed: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" },

  info: { bg: "#DBEAFE", fg: "#1E40AF", border: "#BFDBFE" },
  accepted: { bg: "#DBEAFE", fg: "#1E40AF", border: "#BFDBFE" },
  packed: { bg: "#DBEAFE", fg: "#1E40AF", border: "#BFDBFE" },
  out_for_delivery: { bg: "#EDE9FE", fg: "#5B21B6", border: "#DDD6FE" },
  at_customer: { bg: "#EDE9FE", fg: "#5B21B6", border: "#DDD6FE" },

  danger: { bg: "#FEE2E2", fg: "#991B1B", border: "#FECACA" },
  cancelled: { bg: "#FEE2E2", fg: "#991B1B", border: "#FECACA" },
  inactive: { bg: "#F4F4F5", fg: "#3F3F46", border: "#E4E4E7" },
  pending_assignment: { bg: "#F4F4F5", fg: "#3F3F46", border: "#E4E4E7" },
  assigned: { bg: "#DBEAFE", fg: "#1E40AF", border: "#BFDBFE" },
};

export function Badge({ children, variant = "inactive" }: { children: React.ReactNode; variant?: string }) {
  const key = String(variant).toLowerCase();
  const v = VARIANTS[key] || VARIANTS.inactive;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Text style={[styles.text, { color: v.fg }]}>{String(children).replace(/_/g, " ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: theme.fonts.body,
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },
});
