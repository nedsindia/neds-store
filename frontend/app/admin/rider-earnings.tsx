import React, { useCallback, useEffect, useState } from "react";
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

type Rider = { id: string; name: string; mobile: string };
type Earning = {
  id: string; rider_id: string; order_id: string; delivery_id: string;
  model: string; distance_km: number; base_pay: number; per_km_pay: number;
  bonus: number; total_earning: number; status: string; created_at: string;
};
type Settlement = { id: string; entity_id: string; total_amount: number; delivery_count: number; status: string; created_at: string; paid_at?: string | null };

export default function RiderEarningsPage() {
  const toast = useToast();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selected, setSelected] = useState("");
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadRiders = useCallback(async () => {
    try {
      const r = await api<{ items: Rider[] }>("/users", { query: { role: "rider" } });
      setRiders(r.items);
      if (r.items[0]) setSelected(r.items[0].id);
    } catch (e: any) { toast.error(e.message); }
  }, []);

  const loadForRider = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const [er, se, d] = await Promise.all([
        api<{ items: Earning[] }>("/rider-earnings", { query: { rider_id: selected } }),
        api<{ items: Settlement[] }>("/rider-settlements", { query: { rider_id: selected } }),
        api<any>(`/riders/${selected}/dashboard`),
      ]);
      setEarnings(er.items);
      setSettlements(se.items);
      setDash(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { loadRiders(); }, [loadRiders]);
  useEffect(() => { loadForRider(); }, [loadForRider]);

  const createSettlement = async () => {
    setCreating(true);
    try {
      const s = await api<Settlement>("/rider-settlements", { method: "POST", body: { entity_id: selected } });
      toast.success(`Settlement created — ${inr(s.total_amount)} across ${s.delivery_count} deliveries`);
      loadForRider();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const markPaid = async (s: Settlement) => {
    try {
      await api(`/rider-settlements/${s.id}/mark-paid`, { method: "POST", body: {} });
      toast.success("Settlement marked as paid");
      loadForRider();
    } catch (e: any) { toast.error(e.message); }
  };

  const eCols: Column<Earning>[] = [
    { key: "order_id", label: "Order", flex: 1, render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>#{e.order_id.slice(0, 8)}</Text> },
    { key: "model", label: "Model", flex: 0.9, render: (e) => <Badge variant="info">{e.model}</Badge> },
    { key: "distance_km", label: "Distance", flex: 0.7, align: "right", mono: true, render: (e) => `${e.distance_km} km` },
    { key: "base_pay", label: "Base", flex: 0.7, align: "right", render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>{inr(e.base_pay)}</Text> },
    { key: "per_km_pay", label: "Per-KM", flex: 0.7, align: "right", render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>{inr(e.per_km_pay)}</Text> },
    { key: "bonus", label: "Bonus", flex: 0.7, align: "right", render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: e.bonus > 0 ? theme.colors.primary : theme.colors.textMuted }}>{inr(e.bonus)}</Text> },
    { key: "total_earning", label: "Total", flex: 0.8, align: "right", render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "700", color: theme.colors.primary }}>{inr(e.total_earning)}</Text> },
    { key: "status", label: "Status", flex: 0.8, render: (e) => <Badge variant={e.status === "paid" ? "success" : e.status === "settled" ? "info" : "warning"}>{e.status}</Badge> },
    { key: "created_at", label: "Delivered", flex: 1.1, render: (e) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(e.created_at)}</Text> },
  ];

  const sCols: Column<Settlement>[] = [
    { key: "id", label: "Settlement", flex: 1, render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12 }}>#{s.id.slice(0, 8)}</Text> },
    { key: "total_amount", label: "Total", flex: 0.9, align: "right", render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "700" }}>{inr(s.total_amount)}</Text> },
    { key: "delivery_count", label: "Deliveries", flex: 0.8, align: "right", mono: true, render: (s) => String(s.delivery_count) },
    { key: "status", label: "Status", flex: 0.8, render: (s) => <Badge variant={s.status === "paid" ? "success" : "warning"}>{s.status}</Badge> },
    { key: "created_at", label: "Created", flex: 1.1, render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(s.created_at)}</Text> },
    { key: "paid_at", label: "Paid At", flex: 1.1, render: (s) => <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{s.paid_at ? formatDate(s.paid_at) : "—"}</Text> },
    { key: "actions", label: "", flex: 0.9, align: "right", render: (s) => s.status !== "paid" ? <Button size="sm" title="Mark Paid" onPress={() => markPaid(s)} testID={`mark-paid-${s.id}`} /> : null },
  ];

  return (
    <View style={{ gap: 16 }} testID="rider-earnings-screen">
      <View style={styles.banner}>
        <Feather name="dollar-sign" size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Enterprise Rider Dashboard &amp; Settlement Engine</Text>
          <Text style={styles.bannerSub}>Every verified delivery creates a pending Earning computed by the active Rider Payment Model (per-delivery / per-km / hybrid / salary) plus bonuses. Bundle pending earnings into a Settlement and mark it Paid once payout is complete.</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <Select
          label="Select Rider"
          value={selected}
          onChange={setSelected}
          options={riders.map((r) => ({ label: `${r.name} (+91 ${r.mobile})`, value: r.id }))}
          width={340}
          testID="rider-select"
        />
        <View style={{ flex: 1 }} />
        <Button title={creating ? "Creating…" : "+ Create Settlement from Pending"} onPress={createSettlement} loading={creating} disabled={!dash || dash?.pending_payout?.deliveries === 0} testID="create-settlement" />
      </View>

      <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
        <KpiCard title="Today" value={inr(dash?.today?.earning || 0)} hint={`${dash?.today?.deliveries || 0} deliveries · ${(dash?.today?.km || 0).toFixed(1)} km`} />
        <KpiCard title="This Week" value={inr(dash?.week?.earning || 0)} hint={`${dash?.week?.deliveries || 0} deliveries · ${(dash?.week?.km || 0).toFixed(1)} km`} variant="dark" accent={theme.colors.primary} />
        <KpiCard title="Pending Payout" value={inr(dash?.pending_payout?.amount || 0)} hint={`${dash?.pending_payout?.deliveries || 0} deliveries`} accent={theme.colors.warning} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Earnings Ledger</Text>
        <DataTable columns={eCols} rows={earnings} loading={loading} empty="No earnings yet — earnings are created automatically when a delivery is verified." testID="earnings-table" />
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
