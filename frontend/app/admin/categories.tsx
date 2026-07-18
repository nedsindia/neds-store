import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Category = { id: string; name: string; description?: string | null; icon?: string | null; active: boolean };

export default function CategoriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", icon: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: Category[] }>("/categories");
      setRows(res.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await api("/categories", { method: "POST", body: form });
      toast.success("Category created");
      setModal(false);
      setForm({ name: "", description: "", icon: "" });
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
    { key: "name", label: "Category", flex: 1.5, render: (c) => (
      <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", color: theme.colors.text, fontSize: 13 }}>{c.name}</Text>
    )},
    { key: "description", label: "Description", flex: 2, render: (c) => c.description || "—" },
    { key: "active", label: "Status", flex: 0.8, render: (c) => <Badge variant={c.active ? "active" : "inactive"}>{c.active ? "Active" : "Off"}</Badge> },
    { key: "actions", label: "", flex: 0.7, align: "right", render: (c) => (
      <Button size="sm" variant={c.active ? "outline" : "primary"} title={c.active ? "Disable" : "Enable"} onPress={() => toggle(c)} />
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="categories-screen">
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }} />
        <Button title="+ Add Category" onPress={() => setModal(true)} testID="categories-add-button" />
      </View>
      <DataTable columns={columns} rows={rows} loading={loading} empty="No categories yet." testID="categories-table" />
      <ModalCard visible={modal} onClose={() => setModal(false)} title="Add Category">
        <Input label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} testID="new-category-name" />
        <Input label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline numberOfLines={2} />
        <Input label="Icon (lucide name — optional)" value={form.icon} onChangeText={(v) => setForm({ ...form, icon: v })} placeholder="e.g. shopping-cart" />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
          <Button title={saving ? "Saving…" : "Create"} onPress={submit} loading={saving} testID="new-category-submit" />
        </View>
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", gap: 12 },
});
