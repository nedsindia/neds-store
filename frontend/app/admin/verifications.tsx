import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Column, DataTable } from "@/src/components/DataTable";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { formatDate, theme } from "@/src/theme";

type Verification = {
  id: string;
  order_id: string;
  delivery_id: string;
  rider_id: string;
  code: string;
  rider_lat: number;
  rider_lng: number;
  customer_lat: number;
  customer_lng: number;
  distance_m: number;
  verified_at: string;
};

export default function VerificationsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ items: Verification[] }>("/delivery-verifications");
      setRows(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Verification>[] = [
    { key: "order_id", label: "Order", flex: 1, render: (v) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>#{v.order_id.slice(0, 8)}</Text>
    )},
    { key: "code", label: "Code", flex: 0.7, render: (v) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 14, fontWeight: "700", letterSpacing: 2, color: theme.colors.primary }}>{v.code}</Text>
    )},
    { key: "rider_id", label: "Rider ID", flex: 1.2, render: (v) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{v.rider_id.slice(0, 8)}…</Text>
    )},
    { key: "rider_loc", label: "Rider Location", flex: 1.3, render: (v) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{v.rider_lat.toFixed(5)}, {v.rider_lng.toFixed(5)}</Text>
    )},
    { key: "customer_loc", label: "Customer Location", flex: 1.3, render: (v) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{v.customer_lat.toFixed(5)}, {v.customer_lng.toFixed(5)}</Text>
    )},
    { key: "distance_m", label: "Distance", flex: 0.7, align: "right", render: (v) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text }}>{v.distance_m.toFixed(0)} m</Text>
    )},
    { key: "verified_at", label: "Verified At", flex: 1.2, render: (v) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(v.verified_at)}</Text>
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="verifications-screen">
      <View style={styles.banner}>
        <Feather name="check-circle" size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Delivery Verification Code Logs</Text>
          <Text style={styles.bannerSub}>
            Auto-generated when the rider enters the customer&apos;s delivery radius. The code is visible only in the
            customer app and, once entered by the rider, marks the order as Delivered — with rider &amp; customer GPS
            coordinates, distance and exact verification time logged here for audit.
          </Text>
        </View>
      </View>
      <DataTable columns={columns} rows={rows} loading={loading} empty="No verified deliveries yet." testID="verifications-table" />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  bannerTitle: { fontFamily: theme.fonts.heading, fontWeight: "700", color: "#065F46", fontSize: 14 },
  bannerSub: { fontFamily: theme.fonts.body, color: "#065F46", fontSize: 12, marginTop: 2, lineHeight: 18 },
});
