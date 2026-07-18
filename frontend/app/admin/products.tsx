import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { Select } from "@/src/components/Select";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { inr, theme } from "@/src/theme";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  category_id: string;
  seller_id: string;
  price: number;
  mrp: number;
  stock: number;
  unit: string;
  active: boolean;
};

type Category = { id: string; name: string };
type Seller = { id: string; name: string; mobile: string };

export default function ProductsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", mrp: "", stock: "", unit: "pc", category_id: "", seller_id: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([
        api<{ items: Product[] }>("/products", { query: { q, category_id: categoryId } }),
        api<{ items: Category[] }>("/categories"),
        api<{ items: Seller[] }>("/users", { query: { role: "seller" } }),
      ]);
      setRows(p.items);
      setCats(c.items);
      setSellers(s.items);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, categoryId]);

  useEffect(() => { load(); }, [load]);

  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));
  const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s.name]));

  const openCreate = () => {
    setForm({ name: "", price: "", mrp: "", stock: "0", unit: "pc", category_id: cats[0]?.id || "", seller_id: sellers[0]?.id || "", description: "" });
    setErrors({});
    setModal(true);
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.category_id) e.category_id = "Category required";
    if (!form.seller_id) e.seller_id = "Seller required (create a seller in Users first)";
    if (!form.price || isNaN(Number(form.price))) e.price = "Valid price required";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      await api("/products", { method: "POST", body: {
        name: form.name,
        description: form.description || null,
        category_id: form.category_id,
        seller_id: form.seller_id,
        price: Number(form.price),
        mrp: form.mrp ? Number(form.mrp) : Number(form.price),
        stock: Number(form.stock || 0),
        unit: form.unit,
      }});
      toast.success("Product created");
      setModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      if (p.active) {
        await api(`/products/${p.id}`, { method: "DELETE" });
      } else {
        await api(`/products/${p.id}`, { method: "PATCH", body: { active: true } });
      }
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const columns: Column<Product>[] = [
    { key: "name", label: "Product", flex: 1.6, render: (p) => (
      <View>
        <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", color: theme.colors.text, fontSize: 13 }}>{p.name}</Text>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>{p.description || "—"}</Text>
      </View>
    )},
    { key: "category", label: "Category", flex: 1, render: (p) => catMap[p.category_id] || "—" },
    { key: "seller", label: "Seller", flex: 1, render: (p) => sellerMap[p.seller_id] || "—" },
    { key: "price", label: "Price", flex: 0.8, align: "right", render: (p) => (
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "600", color: theme.colors.text }}>{inr(p.price)}</Text>
        {p.mrp > p.price ? <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSubtle, textDecorationLine: "line-through" }}>{inr(p.mrp)}</Text> : null}
      </View>
    )},
    { key: "stock", label: "Stock", flex: 0.6, align: "right", mono: true, render: (p) => `${p.stock} ${p.unit}` },
    { key: "active", label: "Status", flex: 0.7, render: (p) => <Badge variant={p.active ? "active" : "inactive"}>{p.active ? "Active" : "Off"}</Badge> },
    { key: "actions", label: "", flex: 0.7, align: "right", render: (p) => (
      <Button size="sm" variant={p.active ? "outline" : "primary"} title={p.active ? "Disable" : "Enable"} onPress={() => toggleActive(p)} />
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="products-screen">
      <View style={styles.toolbar}>
        <Input testID="products-search" placeholder="Search products" value={q} onChangeText={setQ} containerStyle={{ flex: 1, maxWidth: 320 }} />
        <Select testID="products-category-filter" value={categoryId} onChange={setCategoryId} options={[{ label: "All categories", value: "" }, ...cats.map((c) => ({ label: c.name, value: c.id }))]} width={220} />
        <View style={{ flex: 1 }} />
        <Button title="+ Add Product" onPress={openCreate} testID="products-add-button" />
      </View>

      <DataTable columns={columns} rows={rows} loading={loading} empty="No products yet." testID="products-table" />

      <ModalCard visible={modal} onClose={() => setModal(false)} title="Add Product" width={560}>
        <Input label="Product Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={errors.name} testID="new-product-name" />
        <Input label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline numberOfLines={2} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Select label="Category" value={form.category_id} onChange={(v) => setForm({ ...form, category_id: v })} options={cats.map((c) => ({ label: c.name, value: c.id }))} testID="new-product-category" width={"48%" as any} />
          <Select label="Seller" value={form.seller_id} onChange={(v) => setForm({ ...form, seller_id: v })} options={sellers.map((s) => ({ label: `${s.name} (+91 ${s.mobile})`, value: s.id }))} testID="new-product-seller" width={"48%" as any} />
        </View>
        {errors.seller_id ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{errors.seller_id}</Text> : null}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input label="Price (₹)" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="decimal-pad" error={errors.price} containerStyle={{ flex: 1 }} testID="new-product-price" />
          <Input label="MRP (₹)" value={form.mrp} onChangeText={(v) => setForm({ ...form, mrp: v })} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} />
          <Input label="Stock" value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v.replace(/\D/g, "") })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
          <Select label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} options={[{label:"pc", value:"pc"}, {label:"kg",value:"kg"},{label:"g",value:"g"},{label:"ltr",value:"ltr"},{label:"ml",value:"ml"}]} width={100} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
          <Button title={saving ? "Saving…" : "Create Product"} onPress={submit} loading={saving} testID="new-product-submit" />
        </View>
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
});
