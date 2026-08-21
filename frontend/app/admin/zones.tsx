import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { KpiCard } from "@/src/components/KpiCard";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Zone = {
  id: string; name: string; description?: string;
  center_lat: number; center_lng: number; radius_km: number;
  extra_delivery_charge: number; active: boolean;
};

export default function ZonesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Zone[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState({ name: "", description: "", center_lat: "", center_lng: "", radius_km: "5", extra_delivery_charge: "0", active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setRows((await api<{ items: Zone[] }>("/delivery-zones")).items); }
    catch (e: any) { toast.error(e.message); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", center_lat: "", center_lng: "", radius_km: "5", extra_delivery_charge: "0", active: true });
    setModal(true);
  };

  const openEdit = (z: Zone) => {
    setEditing(z);
    setForm({ name: z.name, description: z.description || "", center_lat: String(z.center_lat), center_lng: String(z.center_lng), radius_km: String(z.radius_km), extra_delivery_charge: String(z.extra_delivery_charge), active: z.active });
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name, description: form.description,
        center_lat: parseFloat(form.center_lat), center_lng: parseFloat(form.center_lng),
        radius_km: parseFloat(form.radius_km), extra_delivery_charge: parseFloat(form.extra_delivery_charge) || 0,
        active: form.active,
      };
      if (!body.name.trim()) throw new Error("Name required");
      if (Number.isNaN(body.center_lat) || Number.isNaN(body.center_lng)) throw new Error("Enter valid lat/lng");
      if (editing) {
        await api(`/delivery-zones/${editing.id}`, { method: "PATCH", body });
        toast.success("Zone updated");
      } else {
        await api("/delivery-zones", { method: "POST", body });
        toast.success("Zone created");
      }
      setModal(false); await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const del = async (z: Zone) => {
    if (!window.confirm(`Delete zone "${z.name}"?`)) return;
    try { await api(`/delivery-zones/${z.id}`, { method: "DELETE" }); await load(); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (z: Zone) => {
    try { await api(`/delivery-zones/${z.id}`, { method: "PATCH", body: { active: !z.active } }); await load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={styles.title}>Delivery Zones</Text>
          <Text style={styles.subtitle}>Define serviceable areas (center + radius). Extra delivery charge applies within each zone.</Text>
        </View>
        <Button title="Create Zone" onPress={openCreate} />
      </View>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <KpiCard title="Total Zones" value={rows.length} accent={theme.colors.primary} />
        <KpiCard title="Active" value={rows.filter((z) => z.active).length} accent="#10B981" />
        <KpiCard title="Total Coverage" value={`${rows.reduce((s, z) => s + (z.radius_km || 0), 0).toFixed(1)} km`} accent="#3B82F6" />
      </View>

      <View style={{ gap: 10 }}>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No zones yet. Click Create Zone to add serviceable areas.</Text>
        ) : rows.map((z) => (
          <View key={z.id} style={styles.zoneCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.zoneName}>{z.name}</Text>
                <Badge variant={z.active ? "success" : "inactive"}>{z.active ? "Active" : "Off"}</Badge>
              </View>
              {z.description ? <Text style={styles.sub}>{z.description}</Text> : null}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                <Text style={styles.meta}>📍 {z.center_lat.toFixed(4)}, {z.center_lng.toFixed(4)}</Text>
                <Text style={styles.meta}>Radius: {z.radius_km} km</Text>
                <Text style={styles.meta}>Extra charge: ₹{z.extra_delivery_charge}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Button title="Edit" variant="outline" size="sm" onPress={() => openEdit(z)} />
              <Button title={z.active ? "Disable" : "Enable"} size="sm" onPress={() => toggle(z)} />
              <Button title="Delete" size="sm" variant="danger" onPress={() => del(z)} />
            </View>
          </View>
        ))}
      </View>

      <ModalCard visible={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : "Create Zone"} width={560}>
        <View style={{ gap: 10 }}>
          <Input label="Zone Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Input label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Center Lat" value={form.center_lat} onChangeText={(v) => setForm((f) => ({ ...f, center_lat: v }))} keyboardType="numeric" placeholder="e.g. 12.9716" /></View>
            <View style={{ flex: 1 }}><Input label="Center Lng" value={form.center_lng} onChangeText={(v) => setForm((f) => ({ ...f, center_lng: v }))} keyboardType="numeric" placeholder="e.g. 77.5946" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Radius (km)" value={form.radius_km} onChangeText={(v) => setForm((f) => ({ ...f, radius_km: v }))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Input label="Extra Delivery ₹" value={form.extra_delivery_charge} onChangeText={(v) => setForm((f) => ({ ...f, extra_delivery_charge: v }))} keyboardType="numeric" /></View>
          </View>
          <Text style={styles.note}>💡 Google Maps API key not required — zones use radius calculation. Add API key to .env to enable map preview later.</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
            <Button title={editing ? "Save" : "Create"} onPress={save} loading={saving} />
          </View>
        </View>
      </ModalCard>
    </View>
  );
}

declare const window: any;

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  empty: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textMuted, textAlign: "center", padding: 40, backgroundColor: "#fff", borderRadius: theme.radius.md },
  zoneCard: { flexDirection: "row", gap: 12, alignItems: "center", padding: 16, backgroundColor: "#fff", borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  zoneName: { fontFamily: theme.fonts.heading, fontSize: 15, fontWeight: "700", color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  meta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text },
  note: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, backgroundColor: "#FEF3C7", padding: 8, borderRadius: theme.radius.sm },
});
