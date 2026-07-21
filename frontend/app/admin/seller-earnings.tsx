import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { KpiCard } from "@/src/components/KpiCard";
import { Select } from "@/src/components/Select";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { formatDate, inr, theme } from "@/src/theme";

type Seller = { id: string; name: string; mobile: string };
type Earning = { id: string; seller_id: string; order_id: string; gross_sales: number; commission: number; net_earning: number; status: string; created_at: string; settlement_id?: string | null };
type Settlement = { id: string; entity_id: string; total_amount: number; order_count: number; status: string; created_at: string; paid_at?: string | null; payout_reference?: string | null };

export default function SellerEarningsPage() {
  const toast = useToast();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadSellers = useCallback(async () => {
    try {
      const r = await api<{ items: Seller[] }>("/users", { query: { role: "seller" } });
      setSellers(r.items);
      if (r.items[0]) setSelectedSeller(r.items[0].id);
    } catch (e: any) { toast.error(e.message); }
  }, []);

  const loadForSeller = useCallback(async () => {
    if (!selectedSeller) return;
    setLoading(true);
    try {
      const [er, se, d] = await Promise.all([
        api<{ items: Earning[] }>("/seller-earnings", { query: { seller_id: selectedSeller } }),
        api<{ items: Settlement[] }>("/seller-settlements", { query: { seller_id: selectedSeller } }),
        api<any>(`/sellers/${selectedSeller}/dashboard`),
      ]);
      setEarnings(er.items);
      setSettlements(se.items);
      setDash(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [selectedSeller]);

  useEffect(() => { loadSellers(); }, [loadSellers]);
  useEffect(() => { loadForSeller(); }, [loadForSeller]);

  const createSettlement = async () => {
    setCreating(true);
    try {
      const s = await api<Settlement>("/seller-settlements", { method: "POST", body: { entity_id: selectedSeller } });
      toast.success(`Settlement created — ${inr(s.total_amount)} across ${s.order_count} orders`);
      loadForSeller();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const markPaid = async (s: Settlement) => {
    try {
      await api(`/seller-settlements/${s.id}/mark-paid`, { method: "POST", body: {} });
      toast.success("Settlement marked as paid");
      loadForSeller();
    } catch (e: any) { toast.error(e.message); }
  };

  const eCols: Column<Earning>[] = [
    { key: "order_id", label: "Order", flex: 1, render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>#{e.order_id.slice(0, 8)}</Text> },
    { key: "gross_sales", label: "Gross Sales", flex: 0.9, align: "right", render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13 }}>{inr(e.gross_sales)}</Text> },
    { key: "commission", label: "Commission", flex: 0.9, align: "right", render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>−{inr(e.commission)}</Text> },
    { key: "net_earning", label: "Net Earning", flex: 0.9, align: "right", render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "700", color: theme.colors.primary }}>{inr(e.net_earning)}</Text> },
    { key: "status", label: "Status", flex: 0.8, render: (e) => <Badge variant={e.status === "paid" ? "success" : e.status === "settled" ? "info" : "warning"}>{e.status}</Badge> },
    { key: "created_at", label: "Delivered", flex: 1.1, render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(e.created_at)}</Text> },
  ];

  const sCols: Column<Settlement>[] = [
    { key: "id", label: "Settlement", flex: 1, render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>#{s.id.slice(0, 8)}</Text> },
    { key: "total_amount", label: "Total", flex: 0.9, align: "right", render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "700" }}>{inr(s.total_amount)}</Text> },
    { key: "order_count", label: "Orders", flex: 0.7, align: "right", mono: true, render: (s) => String(s.order_count) },
    { key: "status", label: "Status", flex: 0.8, render: (s) => <Badge variant={s.status === "paid" ? "success" : "warning"}>{s.status}</Badge> },
    { key: "created_at", label: "Created", flex: 1.1, render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(s.created_at)}</Text> },
    { key: "paid_at", label: "Paid At", flex: 1.1, render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{s.paid_at ? formatDate(s.paid_at) : "—"}</Text> },
    { key: "actions", label: "", flex: 0.9, align: "right", render: (s) => s.status !== "paid" ? <Button size="sm" title="Mark Paid" onPress={() => markPaid(s)} testID={`mark-paid-${s.id}`} /> : null },
  ];

  return (
    <View style={{ gap: 16 }} testID="seller-earnings-screen">
      <View style={styles.banner}>
        <Feather name="trending-up" size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Enterprise Seller Financial Dashboard &amp; Settlement Engine</Text>
          <Text style={styles.bannerSub}>Every delivered order creates a pending Earning per seller (Gross − Commission = Net). Bundle pending earnings into a Settlement, then mark it Paid once the payout has been sent to the seller&apos;s primary bank/UPI account.</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <Select
          label="Select Seller"
          value={selectedSeller}
          onChange={setSelectedSeller}
          options={sellers.map((s) => ({ label: `${s.name} (+91 ${s.mobile})`, value: s.id }))}
          width={340}
          testID="seller-select"
        />
        <View style={{ flex: 1 }} />
        <Button title={creating ? "Creating…" : "+ Create Settlement from Pending"} onPress={createSettlement} loading={creating} disabled={!dash || dash.pending_orders === 0} testID="create-settlement" />
      </View>

      <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
        <KpiCard title="Pending Payout" value={inr(dash?.pending_amount || 0)} hint={`${dash?.pending_orders || 0} orders`} accent={theme.colors.warning} />
        <KpiCard title="Settled Amount" value={inr(dash?.settled_amount || 0)} hint={`${dash?.settled_orders || 0} orders`} variant="dark" accent={theme.colors.primary} />
        <KpiCard title="Total Gross" value={inr(dash?.total_gross || 0)} hint="All delivered orders" />
        <KpiCard title="Total Commission" value={inr(dash?.total_commission || 0)} hint="Platform revenue" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Earnings Ledger</Text>
        <DataTable columns={eCols} rows={earnings} loading={loading} empty="No earnings yet — earnings are created automatically when an order is verified as delivered." testID="earnings-table" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settlement History</Text>
        <DataTable columns={sCols} rows={settlements} loading={loading} empty="No settlements yet." testID="settlements-table" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", gap: 12, padding: 16, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight, borderWidth: 1, borderColor: "#A7F3D0",
  },
  bannerTitle: { fontFamily: theme.fonts.heading, fontWeight: "700", color: "#065F46", fontSize: 14 },
  bannerSub: { fontFamily: theme.fonts.body, color: "#065F46", fontSize: 12, marginTop: 2, lineHeight: 18 },
  card: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: 20, gap: 12,
  },
  cardTitle: { fontFamily: theme.fonts.heading, fontSize: 15, fontWeight: "700", color: theme.colors.text },
});
