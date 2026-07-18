import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { KpiCard } from "@/src/components/KpiCard";
import { DataTable, Column } from "@/src/components/DataTable";
import { Badge } from "@/src/components/Badge";
import { api } from "@/src/api/client";
import { theme, inr, formatDate } from "@/src/theme";
import { useToast } from "@/src/components/Toast";

type Summary = {
  kpis: {
    total_orders: number;
    todays_orders: number;
    total_revenue: number;
    total_commission: number;
    active_customers: number;
    active_sellers: number;
    active_riders: number;
    total_products: number;
    pending_deliveries: number;
  };
  trend: { date: string; orders: number; revenue: number }[];
};

type LiveRider = {
  id: string;
  order_id: string;
  rider_id: string | null;
  rider_lat: number | null;
  rider_lng: number | null;
  status: string;
  rider?: { name: string; mobile: string } | null;
};

export default function Dashboard() {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [riders, setRiders] = useState<LiveRider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([
          api<Summary>("/dashboard/summary"),
          api<{ items: LiveRider[] }>("/dashboard/live-riders"),
        ]);
        setSummary(s);
        setRiders(r.items);
      } catch (e: any) {
        toast.error(e.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 48 }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const k = summary?.kpis;

  const maxRev = Math.max(1, ...(summary?.trend || []).map((d) => d.revenue));

  const riderCols: Column<LiveRider>[] = [
    { key: "rider", label: "Rider", flex: 1.5, render: (r) => (
      <View>
        <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", color: theme.colors.text, fontSize: 13 }}>{r.rider?.name || "—"}</Text>
        <Text style={{ fontFamily: theme.fonts.mono, color: theme.colors.textMuted, fontSize: 12 }}>+91 {r.rider?.mobile || "—"}</Text>
      </View>
    )},
    { key: "order_id", label: "Order", flex: 1.2, mono: true, render: (r) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text }}>{r.order_id.slice(0, 8)}…</Text>
    )},
    { key: "status", label: "Status", flex: 1, render: (r) => <Badge variant={r.status}>{r.status}</Badge> },
    { key: "loc", label: "Location", flex: 1.5, mono: true, render: (r) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>
        {r.rider_lat != null ? `${r.rider_lat.toFixed(4)}, ${r.rider_lng?.toFixed(4)}` : "—"}
      </Text>
    )},
  ];

  return (
    <View style={{ gap: 24 }} testID="dashboard-screen">
      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <KpiCard testID="kpi-total-orders" title="Total Orders" value={k?.total_orders ?? 0} hint={`${k?.todays_orders ?? 0} today`} />
        <KpiCard testID="kpi-total-revenue" title="Revenue (Delivered)" value={inr(k?.total_revenue ?? 0)} hint={`Commission ${inr(k?.total_commission ?? 0)}`} variant="dark" accent={theme.colors.primary} />
        <KpiCard testID="kpi-active-riders" title="Active Riders" value={k?.active_riders ?? 0} hint={`${k?.pending_deliveries ?? 0} pending deliveries`} />
        <KpiCard testID="kpi-active-sellers" title="Active Sellers" value={k?.active_sellers ?? 0} hint={`${k?.total_products ?? 0} products live`} />
        <KpiCard testID="kpi-active-customers" title="Active Customers" value={k?.active_customers ?? 0} hint="Verified users" />
      </View>

      {/* Trend Chart (simple bar chart) + Live Rider Map placeholder */}
      <View style={styles.rowSplit}>
        <View style={styles.chartCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>7-Day Revenue Trend</Text>
            <Text style={styles.cardSub}>Delivered orders only</Text>
          </View>
          {summary?.trend && summary.trend.length > 0 ? (
            <View style={styles.chart}>
              {summary.trend.map((d) => (
                <View key={d.date} style={styles.chartCol}>
                  <View style={styles.chartBarWrap}>
                    <View style={[styles.chartBar, { height: `${Math.round((d.revenue / maxRev) * 100)}%` }]} />
                  </View>
                  <Text style={styles.chartLabel}>{d.date.slice(5)}</Text>
                  <Text style={styles.chartValue}>{inr(d.revenue)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Feather name="bar-chart-2" size={40} color={theme.colors.textSubtle} />
              <Text style={styles.emptyText}>No delivery activity yet — data appears as orders complete.</Text>
            </View>
          )}
        </View>

        <View style={styles.mapCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Live Rider Monitoring</Text>
            <Text style={styles.cardSub}>Google Maps · {riders.length} active</Text>
          </View>
          <View style={styles.mapPlaceholder}>
            {/* Placeholder grid map (Google Maps embedded in production with real API key) */}
            <View style={styles.mapGrid}>
              {Array.from({ length: 6 * 6 }).map((_, i) => (
                <View key={i} style={styles.mapCell} />
              ))}
            </View>
            {riders.slice(0, 6).map((r, i) => (
              <View
                key={r.id}
                style={[
                  styles.pin,
                  {
                    top: `${20 + (i * 47) % 60}%`,
                    left: `${15 + (i * 73) % 70}%`,
                  },
                ]}
              >
                <Feather name="navigation" size={12} color="#fff" />
              </View>
            ))}
            <View style={styles.mapBadge}>
              <Feather name="map-pin" size={11} color={theme.colors.primary} />
              <Text style={styles.mapBadgeText}>Google Maps · API Key placeholder</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Active riders table */}
      <View style={styles.tableCard}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Active Rider Deliveries</Text>
          <Text style={styles.cardSub}>Real-time GPS positions from the rider app</Text>
        </View>
        <DataTable
          columns={riderCols}
          rows={riders}
          empty="No active riders on the road right now."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiGrid: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  rowSplit: {
    flexDirection: "row",
    gap: 16,
  },
  chartCard: {
    flex: 1.3,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 20,
    gap: 16,
    minWidth: 400,
  },
  mapCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 20,
    gap: 16,
    minWidth: 340,
  },
  tableCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 20,
    gap: 16,
  },
  cardHead: {
    gap: 2,
  },
  cardTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },
  cardSub: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 220,
    paddingTop: 20,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  chartBarWrap: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    minHeight: 20,
  },
  chartBar: {
    width: "70%",
    alignSelf: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    minHeight: 6,
  },
  chartLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.mono,
  },
  chartValue: {
    fontSize: 10,
    color: theme.colors.textSubtle,
    fontFamily: theme.fonts.mono,
  },
  emptyChart: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 300,
  },
  mapPlaceholder: {
    height: 240,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    position: "relative",
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  mapCell: {
    width: "16.66%",
    height: "16.66%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  pin: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore
    boxShadow: "0 4px 12px rgba(5,150,105,0.5)",
    borderWidth: 2,
    borderColor: "#fff",
  } as any,
  mapBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  mapBadgeText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.text,
  },
});
