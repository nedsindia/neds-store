import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Category = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  active: boolean;
  min_commission: number;
  max_commission: number;
};

type FormState = {
  id: string | null;
  name: string;
  description: string;
  icon: string;
  min_commission: string;
  max_commission: string;
};

const EMPTY: FormState = { id: null, name: "", description: "", icon: "", min_commission: "5", max_commission: "20" };

function fmtPct(v: number): string {
  if (v == null || Number.isNaN(v)) return String(v);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

export default function CategoriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: Category[] }>("/categories");
      setRows(res.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setErrors({}); setModal(true); };
  const openEdit = (c: Category) => {
    setForm({
      id: c.id,
      name: c.name,
      description: c.description || "",
      icon: c.icon || "",
      min_commission: String(c.min_commission),
      max_commission: String(c.max_commission),
    });
    setErrors({});
    setModal(true);
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name required";
    const lo = Number(form.min_commission);
    const hi = Number(form.max_commission);
    if (isNaN(lo) || lo < 0 || lo > 100) e.min_commission = "0–100";
    if (isNaN(hi) || hi < 0 || hi > 100) e.max_commission = "0–100";
    if (!isNaN(lo) && !isNaN(hi) && lo > hi) e.max_commission = "Max must be ≥ Min";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        icon: form.icon || null,
        min_commission: lo,
        max_commission: hi,
      };
      if (form.id) {
        await api(`/categories/${form.id}`, { method: "PATCH", body });
        toast.success("Category updated");
      } else {
        await api("/categories", { method: "POST", body });
        toast.success("Category created");
      }
      setModal(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (c: Category) => {
    try {
      if (c.active) await api(`/categories/${c.id}`, { method: "DELETE" });
      else await api(`/categories/${c.id}`, { method: "PATCH", body: { active: true } });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const columns: Column<Category>[] = [
    { key: "name", label: "Category", flex: 1.4, render: (c) => (
      <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", color: theme.colors.text, fontSize: 13 }}>{c.name}</Text>
    )},
    { key: "description", label: "Description", flex: 2, render: (c) => c.description || "—" },
    { key: "range", label: "Commission Range", flex: 1.2, render: (c) => (
      <View style={styles.rangeCell}>
        <Text style={styles.rangeText}>{fmtPct(c.min_commission)}% – {fmtPct(c.max_commission)}%</Text>
        <View style={styles.rangeBar}>
          <View style={[styles.rangeFill, { width: `${Math.min(100, c.max_commission)}%`, left: `${Math.min(100, c.min_commission)}%`, right: undefined, marginLeft: 0 }]} />
        </View>
      </View>
    )},
    { key: "active", label: "Status", flex: 0.7, render: (c) => <Badge variant={c.active ? "active" : "inactive"}>{c.active ? "Active" : "Off"}</Badge> },
    { key: "actions", label: "", flex: 1, align: "right", render: (c) => (
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button size="sm" variant="outline" title="Edit" onPress={() => openEdit(c)} testID={`category-edit-${c.id}`} />
        <Button size="sm" variant={c.active ? "outline" : "primary"} title={c.active ? "Disable" : "Enable"} onPress={() => toggle(c)} />
      </View>
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="categories-screen">
      <View style={styles.banner}>
        <Feather name="percent" size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Category-Based Dynamic Commission</Text>
          <Text style={styles.bannerSub}>
            Each category defines the allowed commission range. Sellers pick a per-product commission within these
            bounds. If you tighten a range, existing products that fall outside will be surfaced as
            <Text style={{ fontWeight: "700" }}> Out of Range </Text>
            on the Products page until corrected.
          </Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={{ flex: 1 }} />
        <Button title="+ Add Category" onPress={openCreate} testID="categories-add-button" />
      </View>

      <DataTable columns={columns} rows={rows} loading={loading} empty="No categories yet." testID="categories-table" />

      <ModalCard visible={modal} onClose={() => setModal(false)} title={form.id ? "Edit Category" : "Add Category"}>
        <Input label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={errors.name} testID="new-category-name" />
        <Input label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline numberOfLines={2} />
        <Input label="Icon (lucide name — optional)" value={form.icon} onChangeText={(v) => setForm({ ...form, icon: v })} placeholder="e.g. shopping-cart" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input
            label="Minimum Commission (%)"
            value={form.min_commission}
            onChangeText={(v) => setForm({ ...form, min_commission: v.replace(/[^0-9.]/g, "") })}
            keyboardType="decimal-pad"
            error={errors.min_commission}
            containerStyle={{ flex: 1 }}
            testID="category-min-commission"
          />
          <Input
            label="Maximum Commission (%)"
            value={form.max_commission}
            onChangeText={(v) => setForm({ ...form, max_commission: v.replace(/[^0-9.]/g, "") })}
            keyboardType="decimal-pad"
            error={errors.max_commission}
            containerStyle={{ flex: 1 }}
            testID="category-max-commission"
          />
        </View>
        <Text style={styles.hint}>
          Sellers can select any commission between {form.min_commission ? fmtPct(Number(form.min_commission)) : "?"}% and {form.max_commission ? fmtPct(Number(form.max_commission)) : "?"}% for products in this category.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
          <Button title={saving ? "Saving…" : form.id ? "Save Changes" : "Create Category"} onPress={submit} loading={saving} testID="new-category-submit" />
        </View>
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", gap: 12 },
  banner: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  bannerTitle: { fontFamily: theme.fonts.heading, fontWeight: "700", color: "#065F46", fontSize: 14 },
  bannerSub: { fontFamily: theme.fonts.body, color: "#065F46", fontSize: 12, marginTop: 2, lineHeight: 18 },
  rangeCell: { gap: 4, width: "100%", maxWidth: 200 },
  rangeText: { fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "600", color: theme.colors.text },
  rangeBar: {
    height: 4,
    backgroundColor: theme.colors.borderLight,
    borderRadius: 2,
    position: "relative",
    overflow: "hidden",
  },
  rangeFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  hint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
});
