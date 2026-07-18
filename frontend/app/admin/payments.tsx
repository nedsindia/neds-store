import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Column, DataTable } from "@/src/components/DataTable";
import { Select } from "@/src/components/Select";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { formatDate, inr, theme } from "@/src/theme";

type Payment = {
  id: string;
  customer_id: string;
  total: number;
  commission: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
};

export default function PaymentsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Payment[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ items: Payment[] }>("/payments", { query: { status } });
      setRows(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Payment>[] = [
    { key: "id", label: "Order", flex: 1, render: (p) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>#{p.id.slice(0, 8)}</Text>
    )},
    { key: "method", label: "Method", flex: 0.8, render: (p) => (
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, fontWeight: "600", textTransform: "uppercase" }}>{p.payment_method}</Text>
    )},
    { key: "total", label: "Amount", flex: 0.9, align: "right", render: (p) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "600", color: theme.colors.text }}>{inr(p.total)}</Text>
    )},
    { key: "commission", label: "Commission", flex: 0.9, align: "right", render: (p) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.primary }}>{inr(p.commission)}</Text>
    )},
    { key: "payment_status", label: "Payment Status", flex: 1, render: (p) => <Badge variant={p.payment_status}>{p.payment_status}</Badge> },
    { key: "status", label: "Order Status", flex: 1, render: (p) => <Badge variant={p.status}>{p.status}</Badge> },
    { key: "created_at", label: "Date", flex: 1.1, render: (p) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(p.created_at)}</Text>
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="payments-screen">
      <View style={styles.toolbar}>
        <Select testID="payments-status-filter" value={status} onChange={setStatus} options={[
          { label: "All", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Paid", value: "paid" },
        ]} width={200} />
      </View>
      <DataTable columns={columns} rows={rows} loading={loading} empty="No payments yet." testID="payments-table" />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
});
