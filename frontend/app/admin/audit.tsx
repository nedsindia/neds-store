import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { formatDate, theme } from "@/src/theme";

type Log = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, any>;
  created_at: string;
};

export default function AuditPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Log[]>([]);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ items: Log[] }>("/audit-logs", { query: { action, entity } });
      setRows(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [action, entity]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Log>[] = [
    { key: "created_at", label: "Time", flex: 1.2, render: (l) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(l.created_at)}</Text>
    )},
    { key: "actor", label: "Actor", flex: 1.4, render: (l) => (
      <View>
        <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", fontSize: 13, color: theme.colors.text }}>{l.actor_name || "System"}</Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, textTransform: "capitalize" }}>{(l.actor_role || "system").replace(/_/g, " ")}</Text>
      </View>
    )},
    { key: "action", label: "Action", flex: 1.2, render: (l) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, fontWeight: "600", color: theme.colors.primary }}>{l.action}</Text>
    )},
    { key: "entity", label: "Entity", flex: 0.9, render: (l) => (
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, textTransform: "capitalize" }}>{l.entity}</Text>
    )},
    { key: "entity_id", label: "Entity ID", flex: 1.2, render: (l) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{l.entity_id ? l.entity_id.slice(0, 8) + "…" : "—"}</Text>
    )},
    { key: "meta", label: "Details", flex: 2, render: (l) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textMuted }} numberOfLines={1}>
        {Object.keys(l.meta || {}).length ? JSON.stringify(l.meta) : "—"}
      </Text>
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="audit-screen">
      <View style={styles.toolbar}>
        <Input testID="audit-action-filter" placeholder="Filter by action e.g. user.create" value={action} onChangeText={setAction} containerStyle={{ flex: 1, maxWidth: 280 }} />
        <Input testID="audit-entity-filter" placeholder="Filter by entity e.g. order" value={entity} onChangeText={setEntity} containerStyle={{ flex: 1, maxWidth: 200 }} />
      </View>
      <DataTable columns={columns} rows={rows} loading={loading} empty="No audit events." testID="audit-table" />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
});
