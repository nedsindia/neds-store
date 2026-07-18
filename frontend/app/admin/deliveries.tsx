import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { ModalCard } from "@/src/components/ModalCard";
import { Select } from "@/src/components/Select";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { formatDate, theme } from "@/src/theme";

type Delivery = {
  id: string;
  order_id: string;
  rider_id: string | null;
  status: string;
  rider_lat: number | null;
  rider_lng: number | null;
  verified_at?: string | null;
  created_at: string;
};

type Rider = { id: string; name: string; mobile: string };

export default function DeliveriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [assignFor, setAssignFor] = useState<Delivery | null>(null);
  const [selectedRider, setSelectedRider] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api<{ items: Delivery[] }>("/deliveries", { query: { status } }),
        api<{ items: Rider[] }>("/users", { query: { role: "rider", active: true } }),
      ]);
      setRows(d.items);
      setRiders(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const riderMap = Object.fromEntries(riders.map((r) => [r.id, r]));

  const openAssign = (d: Delivery) => {
    setAssignFor(d);
    setSelectedRider(riders[0]?.id || "");
  };

  const submitAssign = async () => {
    if (!assignFor || !selectedRider) return;
    setSaving(true);
    try {
      await api(`/deliveries/${assignFor.id}/assign`, { method: "POST", body: { rider_id: selectedRider } });
      toast.success("Rider assigned");
      setAssignFor(null);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const columns: Column<Delivery>[] = [
    { key: "order_id", label: "Order", flex: 1, render: (d) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text }}>#{d.order_id.slice(0, 8)}</Text>
    )},
    { key: "rider", label: "Rider", flex: 1.4, render: (d) => {
      const r = d.rider_id ? riderMap[d.rider_id] : null;
      return r ? (
        <View>
          <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", color: theme.colors.text, fontSize: 13 }}>{r.name}</Text>
          <Text style={{ fontFamily: theme.fonts.mono, color: theme.colors.textMuted, fontSize: 12 }}>+91 {r.mobile}</Text>
        </View>
      ) : (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontFamily: theme.fonts.body }}>Unassigned</Text>
      );
    }},
    { key: "status", label: "Status", flex: 1, render: (d) => <Badge variant={d.status}>{d.status}</Badge> },
    { key: "loc", label: "Rider Location", flex: 1.3, render: (d) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>
        {d.rider_lat != null ? `${d.rider_lat.toFixed(4)}, ${d.rider_lng?.toFixed(4)}` : "—"}
      </Text>
    )},
    { key: "verified_at", label: "Verified", flex: 1.1, render: (d) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>
        {d.verified_at ? formatDate(d.verified_at) : "—"}
      </Text>
    )},
    { key: "created_at", label: "Created", flex: 1.1, render: (d) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(d.created_at)}</Text>
    )},
    { key: "actions", label: "", flex: 0.9, align: "right", render: (d) => (
      <Button
        size="sm"
        variant="outline"
        title={d.rider_id ? "Reassign" : "Assign Rider"}
        onPress={() => openAssign(d)}
        testID={`delivery-assign-${d.id}`}
      />
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="deliveries-screen">
      <View style={styles.toolbar}>
        <Select testID="deliveries-status-filter" value={status} onChange={setStatus} options={[
          { label: "All statuses", value: "" },
          { label: "Pending Assignment", value: "pending_assignment" },
          { label: "Assigned", value: "assigned" },
          { label: "At Customer", value: "at_customer" },
          { label: "Delivered", value: "delivered" },
        ]} width={230} />
      </View>
      <DataTable columns={columns} rows={rows} loading={loading} empty="No deliveries in system." testID="deliveries-table" />

      <ModalCard visible={!!assignFor} onClose={() => setAssignFor(null)} title="Assign Rider to Delivery">
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textMuted, fontSize: 13 }}>
          Order #{assignFor?.order_id.slice(0, 8)}
        </Text>
        {riders.length === 0 ? (
          <Text style={{ color: theme.colors.danger, fontFamily: theme.fonts.body }}>No active riders. Create one in User Management.</Text>
        ) : (
          <Select
            label="Select Rider"
            value={selectedRider}
            onChange={setSelectedRider}
            options={riders.map((r) => ({ label: `${r.name} (+91 ${r.mobile})`, value: r.id }))}
            testID="assign-rider-select"
          />
        )}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button title="Cancel" variant="outline" onPress={() => setAssignFor(null)} />
          <Button title={saving ? "Assigning…" : "Assign"} onPress={submitAssign} loading={saving} disabled={!selectedRider} testID="assign-rider-submit" />
        </View>
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
});
