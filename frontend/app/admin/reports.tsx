import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { KpiCard } from "@/src/components/KpiCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Report = {
  period_days: number;
  orders: { total: number; delivered: number; cancelled: number };
  revenue: { gross: number; commission: number; net_platform: number };
  trend: { date: string; orders: number; revenue: number }[];
  people: any; payments: any; settlements: any; returns: any; inventory: any;
  top_products: { product_id: string; name: string; revenue: number; qty: number }[];
};

const RANGES = [7, 30, 90, 365];
const fmtINR = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ReportsPage() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api<Report>("/reports/overview", { query: { days } })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [days, toast]);
  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Date", "Orders", "Revenue"],
      ...data.trend.map((r) => [r.date, r.orders, r.revenue]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    if (typeof document !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `neds-report-${days}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    }
  };

  const trendMax = Math.max(1, ...(data?.trend || []).map((r) => r.revenue));

  return (
    <ScrollView style={{ maxHeight: "100%" }} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={styles.title}>Reports & Analytics</Text>
          <Text style={styles.subtitle}>Real business metrics from live orders, payments, settlements & inventory.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {RANGES.map((d) => (
            <Button key={d} title={`${d}d`} size="sm" variant={d === days ? "primary" : "outline"} onPress={() => setDays(d)} />
          ))}
          <Button title="Export CSV" size="sm" variant="secondary" onPress={exportCSV} />
        </View>
      </View>

      {data ? (
        <>
          <SectionTitle>Orders & Revenue ({data.period_days}d)</SectionTitle>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <KpiCard title="Total Orders" value={data.orders.total} accent={theme.colors.primary} />
            <KpiCard title="Delivered" value={data.orders.delivered} accent="#10B981" />
            <KpiCard title="Cancelled" value={data.orders.cancelled} accent="#EF4444" />
            <KpiCard title="Gross Revenue" value={fmtINR(data.revenue.gross)} accent="#3B82F6" />
            <KpiCard title="Platform Commission" value={fmtINR(data.revenue.commission)} accent="#8B5CF6" />
          </View>

          <SectionTitle>Trend</SectionTitle>
          <View style={styles.trendBox}>
            {data.trend.length === 0 ? (
              <Text style={styles.empty}>No orders in this range</Text>
            ) : data.trend.slice(-30).map((r) => (
              <View key={r.date} style={{ alignItems: "center", flex: 1 }}>
                <View style={[styles.bar, { height: Math.max(6, (r.revenue / trendMax) * 120), backgroundColor: theme.colors.primary }]} />
                <Text style={styles.trendLabel}>{r.date.slice(5)}</Text>
              </View>
            ))}
          </View>

          <SectionTitle>People</SectionTitle>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <KpiCard title="Customers" value={data.people.customers} accent={theme.colors.primary} />
            <KpiCard title="Sellers" value={`${data.people.active_sellers}/${data.people.sellers}`} accent="#10B981" />
            <KpiCard title="Riders" value={`${data.people.active_riders}/${data.people.riders}`} accent="#F59E0B" />
          </View>

          <SectionTitle>Payments & Settlements</SectionTitle>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <KpiCard title="Paid Orders" value={data.payments.paid} accent="#10B981" />
            <KpiCard title="Pending Payments" value={data.payments.pending} accent="#F59E0B" />
            <KpiCard title="Refunded" value={data.payments.refunded} accent="#EF4444" />
            <KpiCard title="Seller Pending" value={data.settlements.seller_pending} accent="#3B82F6" />
            <KpiCard title="Rider Pending" value={data.settlements.rider_pending} accent="#8B5CF6" />
          </View>

          <SectionTitle>Inventory & Returns</SectionTitle>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <KpiCard title="Total Products" value={data.inventory.total_products} accent={theme.colors.primary} />
            <KpiCard title="Out of Stock" value={data.inventory.out_of_stock} accent="#EF4444" />
            <KpiCard title="Total Returns" value={data.returns.total} accent="#F59E0B" />
            <KpiCard title="Pending Returns" value={data.returns.pending} accent="#F97316" />
          </View>

          <SectionTitle>Top 10 Products by Revenue</SectionTitle>
          <View style={styles.topBox}>
            {data.top_products.length === 0 ? (
              <Text style={styles.empty}>No sales in this range</Text>
            ) : data.top_products.map((p, i) => (
              <View key={p.product_id} style={styles.topRow}>
                <Text style={styles.rank}>#{i + 1}</Text>
                <Text style={[styles.txt, { flex: 2 }]}>{p.name}</Text>
                <Text style={[styles.txt, { flex: 0.5, textAlign: "right" }]}>×{p.qty}</Text>
                <Text style={[styles.txt, { flex: 1, textAlign: "right", fontWeight: "700", color: theme.colors.primary }]}>{fmtINR(p.revenue)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>{loading ? "Loading..." : "No data"}</Text>
      )}
    </ScrollView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

declare const document: any;
declare const URL: any;
declare const Blob: any;

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  sectionTitle: { fontFamily: theme.fonts.heading, fontSize: 14, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },
  txt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  empty: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textMuted, textAlign: "center", padding: 20 },
  trendBox: { flexDirection: "row", alignItems: "flex-end", height: 160, backgroundColor: "#fff", padding: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, gap: 3 },
  bar: { width: "70%", borderRadius: 3, minHeight: 6 },
  trendLabel: { fontSize: 8, color: theme.colors.textMuted, marginTop: 4, fontFamily: theme.fonts.body },
  topBox: { backgroundColor: "#fff", padding: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, gap: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { fontFamily: theme.fonts.heading, fontSize: 13, fontWeight: "700", color: theme.colors.primary, width: 30 },
});
