import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { KpiCard } from "@/src/components/KpiCard";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Coupon = {
  id: string;
  code: string;
  name: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number;
  max_discount?: number | null;
  max_uses?: number | null;
  max_uses_per_customer: number;
  starts_at?: string | null;
  expires_at?: string | null;
  active: boolean;
  usage_count?: number;
};
type Summary = { active_coupons: number; expired_coupons: number; total_uses: number; total_discount_given: number };

const TYPES = [
  { id: "flat", label: "Flat ₹" },
  { id: "percentage", label: "Percentage %" },
  { id: "free_delivery", label: "Free Delivery" },
];

const fmtINR = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function CouponsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "", discount_type: "flat", discount_value: "0", min_order_value: "0", max_discount: "", max_uses: "", max_uses_per_customer: "1", expires_at: "", active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api<{ items: Coupon[] }>("/coupons"),
        api<Summary>("/coupons/summary"),
      ]);
      setRows(c.items); setSummary(s);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", description: "", discount_type: "flat", discount_value: "0", min_order_value: "0", max_discount: "", max_uses: "", max_uses_per_customer: "1", expires_at: "", active: true });
    setModal(true);
  };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code, name: c.name, description: c.description || "",
      discount_type: c.discount_type, discount_value: String(c.discount_value),
      min_order_value: String(c.min_order_value), max_discount: c.max_discount != null ? String(c.max_discount) : "",
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
      max_uses_per_customer: String(c.max_uses_per_customer),
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 10) : "",
      active: c.active,
    });
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body: any = {
        code: form.code.toUpperCase(), name: form.name, description: form.description,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        min_order_value: parseFloat(form.min_order_value) || 0,
        max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        max_uses_per_customer: parseInt(form.max_uses_per_customer) || 1,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        active: form.active,
      };
      if (editing) {
        delete body.code;
        await api(`/coupons/${editing.id}`, { method: "PATCH", body });
        toast.success("Coupon updated");
      } else {
        if (!body.code || !body.name) throw new Error("Code and name required");
        await api("/coupons", { method: "POST", body });
        toast.success("Coupon created");
      }
      setModal(false); await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const del = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon "${c.code}"?`)) return;
    try {
      await api(`/coupons/${c.id}`, { method: "DELETE" });
      toast.success("Deleted"); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (c: Coupon) => {
    try {
      await api(`/coupons/${c.id}`, { method: "PATCH", body: { active: !c.active } });
      toast.success(!c.active ? "Enabled" : "Disabled"); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const cols: Column<Coupon>[] = useMemo(() => [
    { key: "code", label: "Code", flex: 1, render: (c) => <Text style={styles.mono}>{c.code}</Text> },
    { key: "name", label: "Name", flex: 1.5, render: (c) => (
      <View><Text style={styles.txt}>{c.name}</Text>{c.description ? <Text style={styles.sub}>{c.description}</Text> : null}</View>
    )},
    { key: "type", label: "Discount", flex: 1.2, render: (c) => (
      <Text style={styles.txt}>
        {c.discount_type === "flat" ? `${fmtINR(c.discount_value)} off` :
         c.discount_type === "percentage" ? `${c.discount_value}% off` : "Free Delivery"}
      </Text>
    )},
    { key: "min", label: "Min Order", flex: 0.9, render: (c) => <Text style={styles.txt}>{fmtINR(c.min_order_value)}</Text> },
    { key: "uses", label: "Uses", flex: 0.7, render: (c) => <Text style={styles.txt}>{c.usage_count || 0}{c.max_uses ? `/${c.max_uses}` : ""}</Text> },
    { key: "status", label: "Status", flex: 0.7, render: (c) => <Badge variant={c.active ? "success" : "inactive"}>{c.active ? "Active" : "Off"}</Badge> },
    { key: "act", label: "", flex: 1.4, render: (c) => (
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button title="Edit" size="sm" variant="outline" onPress={() => openEdit(c)} />
        <Button title={c.active ? "Disable" : "Enable"} size="sm" onPress={() => toggle(c)} />
        <Button title="Delete" size="sm" variant="danger" onPress={() => del(c)} />
      </View>
    )},
  ], []);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={styles.title}>Coupons & Promotions</Text>
          <Text style={styles.subtitle}>Create discount coupons: flat, percentage, or free delivery. Validated at checkout.</Text>
        </View>
        <Button title="Create Coupon" onPress={openCreate} leftIcon={<Feather name="tag" size={14} color="#fff" />} />
      </View>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <KpiCard title="Active Coupons" value={summary?.active_coupons ?? "—"} accent={theme.colors.primary} />
        <KpiCard title="Expired" value={summary?.expired_coupons ?? "—"} accent="#F59E0B" />
        <KpiCard title="Total Uses" value={summary?.total_uses ?? "—"} accent="#3B82F6" />
        <KpiCard title="Discount Given" value={fmtINR(summary?.total_discount_given)} accent="#8B5CF6" />
      </View>

      <DataTable columns={cols} rows={rows} loading={loading} empty="No coupons yet — click Create Coupon" />

      <ModalCard visible={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.code}` : "Create Coupon"} width={640}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Code" value={form.code} onChangeText={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))} editable={!editing} /></View>
            <View style={{ flex: 2 }}><Input label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} /></View>
          </View>
          <Input label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} />

          <Text style={styles.label}>Discount Type</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {TYPES.map((t) => (
              <Button key={t.id} title={t.label} size="sm"
                variant={form.discount_type === t.id ? "primary" : "outline"}
                onPress={() => setForm((f) => ({ ...f, discount_type: t.id }))} />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {form.discount_type !== "free_delivery" ? (
              <View style={{ flex: 1 }}><Input label={form.discount_type === "flat" ? "Discount ₹" : "Discount %"} value={form.discount_value} onChangeText={(v) => setForm((f) => ({ ...f, discount_value: v }))} keyboardType="numeric" /></View>
            ) : null}
            <View style={{ flex: 1 }}><Input label="Min Order ₹" value={form.min_order_value} onChangeText={(v) => setForm((f) => ({ ...f, min_order_value: v }))} keyboardType="numeric" /></View>
            {form.discount_type === "percentage" ? (
              <View style={{ flex: 1 }}><Input label="Max Discount ₹" value={form.max_discount} onChangeText={(v) => setForm((f) => ({ ...f, max_discount: v }))} keyboardType="numeric" placeholder="Optional cap" /></View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Max Total Uses" value={form.max_uses} onChangeText={(v) => setForm((f) => ({ ...f, max_uses: v }))} placeholder="Blank = unlimited" keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Input label="Uses per Customer" value={form.max_uses_per_customer} onChangeText={(v) => setForm((f) => ({ ...f, max_uses_per_customer: v }))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Input label="Expires On (YYYY-MM-DD)" value={form.expires_at} onChangeText={(v) => setForm((f) => ({ ...f, expires_at: v }))} placeholder="Optional" /></View>
          </View>

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
  txt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  mono: { fontFamily: "monospace", fontSize: 12, color: theme.colors.text, fontWeight: "700" },
  label: { fontFamily: theme.fonts.body, fontSize: 11, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
});
