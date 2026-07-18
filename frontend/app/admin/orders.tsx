import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Column, DataTable } from "@/src/components/DataTable";
import { Select } from "@/src/components/Select";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { formatDate, inr, theme } from "@/src/theme";

type Order = {
  id: string;
  customer_id: string;
  items: any[];
  subtotal: number;
  total: number;
  commission: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  delivery_address: string;
};

const STATUS = [
  { label: "All statuses", value: "" },
  { label: "Placed", value: "placed" },
  { label: "Accepted", value: "accepted" },
  { label: "Packed", value: "packed" },
  { label: "Out for delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export default function OrdersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ items: Order[] }>("/orders", { query: { status } });
      setRows(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Order>[] = [
    { key: "id", label: "Order", flex: 1, render: (o) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text }}>#{o.id.slice(0, 8)}</Text>
    )},
    { key: "items", label: "Items", flex: 0.6, mono: true, align: "right", render: (o) => `${o.items.length}` },
    { key: "total", label: "Total", flex: 0.9, align: "right", render: (o) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "600", color: theme.colors.text }}>{inr(o.total)}</Text>
    )},
    { key: "commission", label: "Commission", flex: 0.9, align: "right", render: (o) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{inr(o.commission)}</Text>
    )},
    { key: "payment", label: "Payment", flex: 0.9, render: (o) => (
      <View style={{ gap: 3 }}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, textTransform: "uppercase", color: theme.colors.text, fontWeight: "600" }}>{o.payment_method}</Text>
        <Badge variant={o.payment_status}>{o.payment_status}</Badge>
      </View>
    )},
    { key: "status", label: "Status", flex: 1, render: (o) => <Badge variant={o.status}>{o.status}</Badge> },
    { key: "created_at", label: "Placed", flex: 1.1, render: (o) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(o.created_at)}</Text>
    )},
    { key: "address", label: "Address", flex: 1.6, render: (o) => (
      <Text numberOfLines={1} style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted }}>{o.delivery_address}</Text>
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="orders-screen">
      <View style={styles.toolbar}>
        <Select testID="orders-status-filter" value={status} onChange={setStatus} options={STATUS} width={220} />
      </View>
      <DataTable columns={columns} rows={rows} loading={loading} empty="No orders yet. Orders from the customer app will appear here." testID="orders-table" />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
});
