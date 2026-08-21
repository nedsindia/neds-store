import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold?: number;
  unit?: string;
  stock_status?: "in_stock" | "low_stock" | "out_of_stock";
  seller_id?: string;
  category_id?: string;
  active?: boolean;
};

type Movement = {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: string;
  previous_stock: number;
  updated_stock: number;
  quantity_changed: number;
  reason?: string;
  order_id?: string | null;
  actor_role?: string;
  created_at: string;
};

type Summary = {
  total_products: number;
  active_products: number;
  out_of_stock: number;
  low_stock: number;
  total_stock_value: number;
  recent_movements_24h: number;
};

const TABS = ["Products", "Stock Movements", "Low Stock", "Out of Stock"] as const;
type Tab = typeof TABS[number];

const fmtINR = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function InventoryPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Products");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Adjust modal
  const [selected, setSelected] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({ delta: "", reason: "", movement_type: "manual_adjustment", note: "" });
  const [thresholdForm, setThresholdForm] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes, sRes] = await Promise.all([
        api<{ items: Product[] }>("/inventory"),
        api<{ items: Movement[] }>("/inventory/movements", { query: { limit: 100 } }),
        api<Summary>("/inventory/summary"),
      ]);
      setProducts(pRes.items);
      setMovements(mRes.items);
      setSummary(sRes);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (tab === "Low Stock") list = list.filter((p) => p.stock_status === "low_stock");
    else if (tab === "Out of Stock") list = list.filter((p) => p.stock_status === "out_of_stock");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, tab, search]);

  const openAdjust = (p: Product) => {
    setSelected(p);
    setAdjustForm({ delta: "", reason: "", movement_type: "manual_adjustment", note: "" });
    setThresholdForm(String(p.low_stock_threshold ?? 5));
  };

  const submitAdjustment = async () => {
    if (!selected) return;
    const delta = parseInt(adjustForm.delta, 10);
    if (!delta || Number.isNaN(delta)) return toast.error("Enter a non-zero delta (+ to add, - to remove)");
    if (!adjustForm.reason.trim()) return toast.error("Reason is required");
    setSaving(true);
    try {
      await api(`/inventory/${selected.id}/adjust`, {
        method: "POST",
        body: {
          delta,
          reason: adjustForm.reason,
          movement_type: adjustForm.movement_type,
          note: adjustForm.note || null,
        },
      });
      toast.success(`Stock adjusted by ${delta > 0 ? "+" : ""}${delta}`);
      setSelected(null);
      await loadAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const updateThreshold = async () => {
    if (!selected) return;
    const t = parseInt(thresholdForm, 10);
    if (Number.isNaN(t) || t < 0) return toast.error("Threshold must be ≥ 0");
    try {
      await api(`/inventory/${selected.id}/threshold`, {
        method: "PATCH",
        body: { low_stock_threshold: t },
      });
      toast.success("Threshold updated");
      await loadAll();
      // refresh selected
      setSelected((s) => s ? { ...s, low_stock_threshold: t } : s);
    } catch (e: any) { toast.error(e.message); }
  };

  const productCols: Column<Product>[] = useMemo(() => [
    { key: "name", label: "Product", flex: 2, render: (p) => (
      <View>
        <Text style={styles.txt}>{p.name}</Text>
        <Text style={styles.sub}>{p.unit || "pc"} · {fmtINR(p.price)}</Text>
      </View>
    )},
    { key: "stock", label: "Stock", flex: 0.6, align: "right", render: (p) => (
      <Text style={[styles.mono, p.stock === 0 && { color: "#EF4444", fontWeight: "700" }]}>{p.stock}</Text>
    )},
    { key: "threshold", label: "Threshold", flex: 0.7, align: "right", render: (p) => <Text style={styles.mono}>{p.low_stock_threshold ?? 5}</Text> },
    { key: "status", label: "Status", flex: 1, render: (p) => (
      <Badge variant={
        p.stock_status === "out_of_stock" ? "danger" :
        p.stock_status === "low_stock" ? "warning" : "success"
      }>{(p.stock_status || "in_stock").replace(/_/g, " ")}</Badge>
    )},
    { key: "value", label: "Value ₹", flex: 0.8, align: "right", render: (p) => <Text style={styles.txt}>{fmtINR((p.stock || 0) * (p.price || 0))}</Text> },
    { key: "actions", label: "", flex: 0.8, render: (p) => (
      <Button title="Adjust" size="sm" variant="outline" onPress={() => openAdjust(p)} leftIcon={<Feather name="edit-3" size={12} color={theme.colors.text} />} />
    )},
  ], []);

  const movementCols: Column<Movement>[] = useMemo(() => [
    { key: "product", label: "Product", flex: 2, render: (m) => (
      <View>
        <Text style={styles.txt}>{m.product_name || "—"}</Text>
        <Text style={styles.sub}>{m.reason || "—"}</Text>
      </View>
    )},
    { key: "type", label: "Type", flex: 1, render: (m) => <Text style={styles.txt}>{m.movement_type.replace(/_/g, " ")}</Text> },
    { key: "change", label: "Change", flex: 0.7, align: "right", render: (m) => (
      <Text style={[styles.mono, { color: m.quantity_changed >= 0 ? theme.colors.primary : "#EF4444", fontWeight: "700" }]}>
        {m.quantity_changed >= 0 ? "+" : ""}{m.quantity_changed}
      </Text>
    )},
    { key: "before_after", label: "Before → After", flex: 1, render: (m) => <Text style={styles.mono}>{m.previous_stock} → {m.updated_stock}</Text> },
    { key: "actor", label: "By", flex: 0.8, render: (m) => <Text style={styles.txt}>{m.actor_role || "system"}</Text> },
    { key: "date", label: "When", flex: 1, render: (m) => <Text style={styles.txt}>{fmtDate(m.created_at)}</Text> },
  ], []);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={styles.title}>Inventory & Stock</Text>
          <Text style={styles.subtitle}>
            Real-time stock tracking. Every change is logged with reason and actor.
          </Text>
        </View>
        <View style={{ width: 260 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Search products..." />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <KpiCard title="Total Products" value={summary?.total_products ?? "—"} accent={theme.colors.primary} />
        <KpiCard title="Active" value={summary?.active_products ?? "—"} accent="#3B82F6" />
        <KpiCard title="Low Stock" value={summary?.low_stock ?? "—"} accent="#F59E0B" />
        <KpiCard title="Out of Stock" value={summary?.out_of_stock ?? "—"} accent="#EF4444" />
        <KpiCard title="Stock Value" value={fmtINR(summary?.total_stock_value)} accent="#8B5CF6" />
        <KpiCard title="24h Movements" value={summary?.recent_movements_24h ?? "—"} accent="#10B981" />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, t === tab && styles.tabActive]}>
            <Text style={[styles.tabText, t === tab && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "Stock Movements" ? (
        <DataTable columns={movementCols} rows={movements} loading={loading} empty="No stock movements yet" />
      ) : (
        <DataTable columns={productCols} rows={filteredProducts} loading={loading} empty="No products match filter" />
      )}

      {/* Adjust Modal */}
      <ModalCard visible={!!selected} onClose={() => setSelected(null)} title={selected ? `Adjust: ${selected.name}` : ""} width={560}>
        {selected ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: "#FAFAFA", padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border }}>
                <Text style={styles.label}>Current Stock</Text>
                <Text style={styles.bigStock}>{selected.stock}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#FAFAFA", padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border }}>
                <Text style={styles.label}>Value</Text>
                <Text style={styles.bigStock}>{fmtINR((selected.stock || 0) * (selected.price || 0))}</Text>
              </View>
            </View>

            <Text style={[styles.label, { marginTop: 8 }]}>Quick Adjust</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {["+10", "+5", "+1", "-1", "-5", "-10"].map((v) => (
                <Pressable key={v} onPress={() => setAdjustForm((f) => ({ ...f, delta: v }))}
                  style={[styles.qkChip, adjustForm.delta === v && styles.qkChipActive]}>
                  <Text style={[styles.chipText, adjustForm.delta === v && { color: "#fff" }]}>{v}</Text>
                </Pressable>
              ))}
            </View>

            <Input label="Delta (+ to add, - to remove)" value={adjustForm.delta} onChangeText={(v) => setAdjustForm((f) => ({ ...f, delta: v }))} keyboardType="numeric" />
            <Input label="Reason (required)" value={adjustForm.reason} onChangeText={(v) => setAdjustForm((f) => ({ ...f, reason: v }))} placeholder="e.g. Received new stock from supplier" />

            <Text style={styles.label}>Movement Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {["purchase", "manual_adjustment", "damaged", "expired", "correction", "return_received"].map((t) => (
                <Pressable key={t} onPress={() => setAdjustForm((f) => ({ ...f, movement_type: t }))}
                  style={[styles.qkChip, adjustForm.movement_type === t && styles.qkChipActive]}>
                  <Text style={[styles.chipText, adjustForm.movement_type === t && { color: "#fff" }]}>{t.replace(/_/g, " ")}</Text>
                </Pressable>
              ))}
            </View>

            <Input label="Note (optional)" value={adjustForm.note} onChangeText={(v) => setAdjustForm((f) => ({ ...f, note: v }))} />

            <View style={{ borderTopWidth: 1, borderColor: theme.colors.border, marginVertical: 4, paddingTop: 12, flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <Input label="Low Stock Threshold" value={thresholdForm} onChangeText={setThresholdForm} keyboardType="numeric" />
              </View>
              <Button title="Save Threshold" variant="outline" onPress={updateThreshold} />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Button title="Cancel" variant="outline" onPress={() => setSelected(null)} />
              <Button title="Adjust Stock" onPress={submitAdjustment} loading={saving} />
            </View>
          </View>
        ) : null}
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  tabBar: { flexDirection: "row", gap: 4, backgroundColor: "#fff", borderRadius: theme.radius.md, padding: 4, alignSelf: "flex-start", borderWidth: 1, borderColor: theme.colors.border },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.sm, cursor: "pointer" as any },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontFamily: theme.fonts.body, fontSize: 13, fontWeight: "500", color: theme.colors.textMuted },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  txt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  mono: { fontFamily: "monospace", fontSize: 13, color: theme.colors.text },
  label: { fontFamily: theme.fonts.body, fontSize: 11, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  bigStock: { fontFamily: theme.fonts.heading, fontSize: 24, fontWeight: "700", color: theme.colors.text, marginTop: 4 },
  qkChip: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, cursor: "pointer" as any, minWidth: 44, alignItems: "center" },
  qkChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text, textTransform: "capitalize" },
});
