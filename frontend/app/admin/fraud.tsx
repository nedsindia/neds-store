import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { KpiCard } from "@/src/components/KpiCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Alert = { customer_id: string; type: string; value: number; risk: string };

export default function FraudPage() {
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAlerts((await api<{ alerts: Alert[] }>("/fraud/alerts")).alerts); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const counts = {
    high: alerts.filter((a) => a.risk === "high").length,
    medium: alerts.filter((a) => a.risk === "medium").length,
    total: alerts.length,
  };

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={styles.title}>Fraud & Risk Alerts</Text>
        <Text style={styles.subtitle}>Read-only risk detection based on real order patterns. No accounts are auto-blocked.</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <KpiCard title="High Risk" value={counts.high} accent="#EF4444" />
        <KpiCard title="Medium Risk" value={counts.medium} accent="#F59E0B" />
        <KpiCard title="Total Alerts" value={counts.total} accent={theme.colors.primary} />
      </View>

      <View style={{ gap: 8 }}>
        {alerts.length === 0 ? (
          <Text style={styles.empty}>✅ No suspicious patterns detected — {loading ? "loading..." : "system healthy"}</Text>
        ) : alerts.map((a, i) => (
          <View key={i} style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Badge variant={a.risk === "high" ? "danger" : "warning"}>{a.risk} risk</Badge>
                <Text style={styles.type}>{a.type.replace(/_/g, " ")}</Text>
              </View>
              <Text style={styles.detail}>Customer <Text style={styles.mono}>{a.customer_id.substring(0, 12)}</Text> — value: {a.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.note}>💡 This is a lightweight heuristic engine — repeated cancellations, payment failures, or returns. Admin should manually review flagged users.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  empty: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textMuted, textAlign: "center", padding: 40, backgroundColor: "#fff", borderRadius: theme.radius.md },
  card: { flexDirection: "row", padding: 16, backgroundColor: "#fff", borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", gap: 12 },
  type: { fontFamily: theme.fonts.body, fontSize: 14, fontWeight: "600", color: theme.colors.text, textTransform: "capitalize" },
  detail: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  mono: { fontFamily: "monospace", fontSize: 12, color: theme.colors.text },
  note: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, backgroundColor: "#EFF6FF", padding: 12, borderRadius: theme.radius.sm, borderLeftWidth: 3, borderLeftColor: "#3B82F6" },
});
