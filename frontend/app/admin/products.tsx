import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

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
  commission_percentage: number;
  // decorated by backend:
  out_of_range?: boolean;
  category_name?: string;
  category_min_commission?: number;
  category_max_commission?: number;
};

type Category = { id: string; name: string; min_commission: number; max_commission: number };
type Seller = { id: string; name: string; mobile: string };

type FormState = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  mrp: string;
  stock: string;
  unit: string;
  category_id: string;
  seller_id: string;
  commission_percentage: string;
  weight_kg: string;
  is_bulky: boolean;
  bulky_charge: string;
};

const EMPTY: FormState = {
  id: null,
  name: "",
  description: "",
  price: "",
  mrp: "",
  stock: "0",
  unit: "pc",
  category_id: "",
  seller_id: "",
  commission_percentage: "",
  weight_kg: "0",
  is_bulky: false,
  bulky_charge: "0",
};

export default function ProductsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showOnlyOOR, setShowOnlyOOR] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
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

  const catMap = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);
  const sellerMap = useMemo(() => Object.fromEntries(sellers.map((s) => [s.id, s.name])), [sellers]);
  const displayRows = useMemo(() => showOnlyOOR ? rows.filter((r) => r.out_of_range) : rows, [rows, showOnlyOOR]);
  const outOfRangeCount = useMemo(() => rows.filter((r) => r.out_of_range).length, [rows]);

  // Selected category's range for the modal
  const selectedCat = form.category_id ? catMap[form.category_id] : undefined;
  const rangeLo = selectedCat?.min_commission;
  const rangeHi = selectedCat?.max_commission;

  const openCreate = () => {
    const firstCat = cats[0];
    setForm({
      ...EMPTY,
      category_id: firstCat?.id || "",
      seller_id: sellers[0]?.id || "",
      commission_percentage: firstCat ? String(firstCat.min_commission) : "",
    });
    setErrors({});
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      mrp: String(p.mrp),
      stock: String(p.stock),
      unit: p.unit,
      category_id: p.category_id,
      seller_id: p.seller_id,
      commission_percentage: String(p.commission_percentage),
      weight_kg: String((p as any).weight_kg ?? 0),
      is_bulky: !!(p as any).is_bulky,
      bulky_charge: String((p as any).bulky_charge ?? 0),
    });
    setErrors({});
    setModal(true);
  };

  const onChangeCategory = (v: string) => {
    // when category changes, snap commission to the new min if outside the new range
    const cat = catMap[v];
    let comm = form.commission_percentage;
    const cn = Number(comm);
    if (cat && (!comm || isNaN(cn) || cn < cat.min_commission || cn > cat.max_commission)) {
      comm = String(cat.min_commission);
    }
    setForm({ ...form, category_id: v, commission_percentage: comm });
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.category_id) e.category_id = "Category required";
    if (!form.seller_id) e.seller_id = "Seller required (create a seller in Users first)";
    if (!form.price || isNaN(Number(form.price))) e.price = "Valid price required";
    const comm = Number(form.commission_percentage);
    const cat = catMap[form.category_id];
    if (!form.commission_percentage || isNaN(comm)) {
      e.commission_percentage = "Commission required";
    } else if (cat && (comm < cat.min_commission || comm > cat.max_commission)) {
      e.commission_percentage = `Commission must be between ${fmtPct(cat.min_commission)}% and ${fmtPct(cat.max_commission)}% for ${cat.name} category.`;
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        category_id: form.category_id,
        seller_id: form.seller_id,
        price: Number(form.price),
        mrp: form.mrp ? Number(form.mrp) : Number(form.price),
        stock: Number(form.stock || 0),
        unit: form.unit,
        commission_percentage: comm,
        weight_kg: Number(form.weight_kg || 0),
        is_bulky: form.is_bulky,
        bulky_charge: form.is_bulky ? Number(form.bulky_charge || 0) : 0,
      };
      if (form.id) {
        await api(`/products/${form.id}`, { method: "PATCH", body });
        toast.success("Product updated");
      } else {
        await api("/products", { method: "POST", body });
        toast.success("Product created");
      }
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
      if (p.active) await api(`/products/${p.id}`, { method: "DELETE" });
      else await api(`/products/${p.id}`, { method: "PATCH", body: { active: true } });
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
    { key: "category", label: "Category", flex: 1, render: (p) => catMap[p.category_id]?.name || "—" },
    { key: "seller", label: "Seller", flex: 1, render: (p) => sellerMap[p.seller_id] || "—" },
    { key: "price", label: "Price", flex: 0.8, align: "right", render: (p) => (
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "600", color: theme.colors.text }}>{inr(p.price)}</Text>
        {p.mrp > p.price ? <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSubtle, textDecorationLine: "line-through" }}>{inr(p.mrp)}</Text> : null}
      </View>
    )},
    { key: "stock", label: "Stock", flex: 0.6, align: "right", mono: true, render: (p) => `${p.stock} ${p.unit}` },
    { key: "commission", label: "Commission", flex: 1.1, render: (p) => {
      const cat = catMap[p.category_id];
      return (
        <View>
          <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: "700", color: p.out_of_range ? theme.colors.danger : theme.colors.primary }}>
            {p.commission_percentage}%
          </Text>
          {cat ? (
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted }}>
              range {fmtPct(cat.min_commission)}–{fmtPct(cat.max_commission)}%
            </Text>
          ) : null}
          {p.out_of_range ? <View style={{ marginTop: 2 }}><Badge variant="danger">Out of Range</Badge></View> : null}
        </View>
      );
    }},
    { key: "active", label: "Status", flex: 0.7, render: (p) => <Badge variant={p.active ? "active" : "inactive"}>{p.active ? "Active" : "Off"}</Badge> },
    { key: "actions", label: "", flex: 1.1, align: "right", render: (p) => (
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button size="sm" variant="outline" title="Edit" onPress={() => openEdit(p)} testID={`product-edit-${p.id}`} />
        <Button size="sm" variant={p.active ? "outline" : "primary"} title={p.active ? "Disable" : "Enable"} onPress={() => toggleActive(p)} />
      </View>
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="products-screen">
      <View style={styles.toolbar}>
        <Input testID="products-search" placeholder="Search products" value={q} onChangeText={setQ} containerStyle={{ flex: 1, maxWidth: 320 }} />
        <Select testID="products-category-filter" value={categoryId} onChange={setCategoryId} options={[{ label: "All categories", value: "" }, ...cats.map((c) => ({ label: c.name, value: c.id }))]} width={220} />
        <Button
          size="sm"
          variant={showOnlyOOR ? "danger" : "outline"}
          title={showOnlyOOR ? `Showing Out of Range (${outOfRangeCount})` : `Out of Range: ${outOfRangeCount}`}
          onPress={() => setShowOnlyOOR((v) => !v)}
          testID="products-oor-toggle"
        />
        <View style={{ flex: 1 }} />
        <Button title="+ Add Product" onPress={openCreate} testID="products-add-button" />
      </View>

      {outOfRangeCount > 0 && !showOnlyOOR ? (
        <View style={styles.warnBanner}>
          <Feather name="alert-triangle" size={16} color="#92400E" />
          <Text style={styles.warnText}>
            {outOfRangeCount} product{outOfRangeCount > 1 ? "s are" : " is"} outside its category's current commission range. Click the badge above to review and correct.
          </Text>
        </View>
      ) : null}

      <DataTable columns={columns} rows={displayRows} loading={loading} empty="No products match your filters." testID="products-table" />

      <ModalCard visible={modal} onClose={() => setModal(false)} title={form.id ? "Edit Product" : "Add Product"} width={620}>
        <Input label="Product Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={errors.name} testID="new-product-name" />
        <Input label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline numberOfLines={2} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Select label="Category" value={form.category_id} onChange={onChangeCategory} options={cats.map((c) => ({ label: c.name, value: c.id }))} testID="new-product-category" width={"48%" as any} />
          <Select label="Seller" value={form.seller_id} onChange={(v) => setForm({ ...form, seller_id: v })} options={sellers.map((s) => ({ label: `${s.name} (+91 ${s.mobile})`, value: s.id }))} testID="new-product-seller" width={"48%" as any} />
        </View>
        {errors.seller_id ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{errors.seller_id}</Text> : null}

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input label="Price (₹)" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="decimal-pad" error={errors.price} containerStyle={{ flex: 1 }} testID="new-product-price" />
          <Input label="MRP (₹)" value={form.mrp} onChangeText={(v) => setForm({ ...form, mrp: v })} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} />
          <Input label="Stock" value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v.replace(/\D/g, "") })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
          <Select label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} options={[{label:"pc", value:"pc"}, {label:"kg",value:"kg"},{label:"g",value:"g"},{label:"ltr",value:"ltr"},{label:"ml",value:"ml"}]} width={100} />
        </View>

        {/* Commission field with dynamic range hint */}
        <View style={styles.commissionBox}>
          <View style={styles.commissionHead}>
            <Text style={styles.commissionLabel}>Commission (%)</Text>
            {selectedCat ? (
              <Text style={styles.commissionHint}>
                Allowed range for <Text style={{ fontWeight: "700" }}>{selectedCat.name}</Text>: {fmtPct(rangeLo!)}% – {fmtPct(rangeHi!)}%
              </Text>
            ) : (
              <Text style={styles.commissionHint}>Select a category to see its allowed range.</Text>
            )}
          </View>
          <Input
            value={form.commission_percentage}
            onChangeText={(v) => setForm({ ...form, commission_percentage: v.replace(/[^0-9.]/g, "") })}
            keyboardType="decimal-pad"
            error={errors.commission_percentage}
            placeholder={rangeLo != null ? `${fmtPct(rangeLo)} – ${fmtPct(rangeHi!)}` : "Choose category first"}
            testID="new-product-commission"
          />
          {selectedCat ? (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {buildQuickPicks(rangeLo!, rangeHi!).map((v) => {
                const active = Number(form.commission_percentage) === v;
                return (
                  <Text
                    key={v}
                    onPress={() => setForm({ ...form, commission_percentage: String(v) })}
                    style={[styles.quickPick, active && styles.quickPickActive]}
                    // @ts-ignore
                    testID={`quickpick-${v}`}
                  >
                    {v}%
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Weight & Bulky (Delivery Engine — Point 1) */}
        <View style={styles.deliveryBox}>
          <View style={styles.deliveryHead}>
            <Text style={styles.commissionLabel}>Delivery Engine</Text>
            <Text style={styles.commissionHint}>Weight is used for weight-slab charges; bulky items add an extra per-item charge on top.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
            <Input
              label="Weight (kg)"
              value={form.weight_kg}
              onChangeText={(v) => setForm({ ...form, weight_kg: v.replace(/[^0-9.]/g, "") })}
              keyboardType="decimal-pad"
              containerStyle={{ flex: 1 }}
              testID="new-product-weight"
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, fontWeight: "600", color: theme.colors.text }}>Bulky Item</Text>
              <View style={styles.bulkyRow}>
                <Switch
                  value={form.is_bulky}
                  onValueChange={(v) => setForm({ ...form, is_bulky: v })}
                  trackColor={{ false: "#D4D4D8", true: theme.colors.primary }}
                  thumbColor="#fff"
                  testID="new-product-is-bulky"
                />
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted }}>
                  {form.is_bulky ? "Yes — extra charge below" : "No"}
                </Text>
              </View>
            </View>
            <Input
              label="Bulky Charge (₹)"
              value={form.bulky_charge}
              onChangeText={(v) => setForm({ ...form, bulky_charge: v.replace(/[^0-9.]/g, "") })}
              keyboardType="decimal-pad"
              editable={form.is_bulky}
              containerStyle={{ flex: 1, opacity: form.is_bulky ? 1 : 0.5 }}
              testID="new-product-bulky-charge"
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
          <Button title={saving ? "Saving…" : form.id ? "Save Changes" : "Create Product"} onPress={submit} loading={saving} testID="new-product-submit" />
        </View>
      </ModalCard>
    </View>
  );
}

function fmtPct(v: number): string {
  if (v == null || Number.isNaN(v)) return String(v);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

function buildQuickPicks(lo: number, hi: number): number[] {
  // Show up to 6 evenly-spaced integer picks in range for fast selection
  const span = hi - lo;
  if (span <= 0) return [lo];
  const steps = Math.min(6, Math.ceil(span) + 1);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const raw = lo + (span * i) / (steps - 1);
    const val = Math.round(raw * 10) / 10;
    if (!out.includes(val)) out.push(val);
  }
  return out;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  warnText: { fontFamily: theme.fonts.body, color: "#92400E", fontSize: 13, flex: 1 },
  commissionBox: {
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgSecondary,
    gap: 8,
  },
  commissionHead: { gap: 4 },
  commissionLabel: { fontFamily: theme.fonts.body, fontWeight: "700", fontSize: 13, color: theme.colors.text },
  commissionHint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted },
  quickPick: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    color: theme.colors.text,
    // @ts-ignore
    cursor: "pointer",
  } as any,
  quickPickActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    color: "#065F46",
  },
  deliveryBox: {
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgSecondary,
    gap: 8,
  },
  deliveryHead: { gap: 4 },
  bulkyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
});
