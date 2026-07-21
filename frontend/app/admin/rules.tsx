import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Select } from "@/src/components/Select";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type WeightSlab = { min_kg: number; max_kg: number | null; charge: number };

type Rules = {
  // General
  commission_percent: number;
  delivery_radius_km: number;
  delivery_charge: number;
  free_delivery_above: number;
  min_order_amount: number;
  verification_radius_meters: number;
  platform_name: string;
  support_mobile: string;
  // Enterprise Delivery Charge Engine
  minimum_delivery_distance_km: number;
  minimum_delivery_charge: number;
  per_km_charge: number;
  maximum_delivery_radius_km: number;
  free_delivery_threshold: number;
  is_free_delivery_enabled: boolean;
  weight_charge_rules: WeightSlab[];
  default_seller_lat: number;
  default_seller_lng: number;
  // Rider Payment Model (Point 4)
  rider_payment_model: string;
  rider_base_pay: number;
  rider_per_km_pay: number;
  rider_bonus_per_delivery_after: number;
  rider_bonus_amount: number;
  rider_monthly_salary: number;
};

const RIDER_FIELDS: { key: keyof Rules; label: string; suffix: string; hint: string }[] = [
  { key: "rider_base_pay", label: "Base Pay per Delivery", suffix: "₹", hint: "Flat amount paid per delivery (used in per_delivery and hybrid models)." },
  { key: "rider_per_km_pay", label: "Per KM Pay", suffix: "₹", hint: "Multiplied by delivery distance (used in per_km and hybrid models)." },
  { key: "rider_bonus_per_delivery_after", label: "Bonus Threshold (deliveries/day)", suffix: "", hint: "Riders earn the bonus below on every delivery AFTER this daily count." },
  { key: "rider_bonus_amount", label: "Bonus Amount", suffix: "₹", hint: "Bonus added to each qualifying delivery." },
  { key: "rider_monthly_salary", label: "Monthly Salary", suffix: "₹", hint: "Fixed salary (used only for the salary model — per-delivery earning is 0)." },
];

const GENERAL_FIELDS: { key: keyof Rules; label: string; suffix?: string; hint?: string; numeric?: boolean }[] = [
  { key: "commission_percent", label: "Fallback Global Commission", suffix: "%", numeric: true, hint: "Used only when a legacy product has no per-product commission set." },
  { key: "min_order_amount", label: "Minimum Order Amount", suffix: "₹", numeric: true, hint: "Orders below this cannot be placed." },
  { key: "verification_radius_meters", label: "Delivery Verification Radius", suffix: "m", numeric: true, hint: "Rider must be inside this radius before the code is generated." },
  { key: "platform_name", label: "Platform Name" },
  { key: "support_mobile", label: "Support Contact Number" },
];

const DELIVERY_FIELDS: { key: keyof Rules; label: string; suffix: string; hint: string }[] = [
  { key: "minimum_delivery_distance_km", label: "Minimum Delivery Distance", suffix: "km", hint: "Distance up to which only the minimum charge applies (no per-km add-on)." },
  { key: "minimum_delivery_charge", label: "Minimum Delivery Charge", suffix: "₹", hint: "Base delivery fee applied for any delivery inside the minimum-distance zone." },
  { key: "per_km_charge", label: "Per Kilometer Charge", suffix: "₹", hint: "Applied on every additional km beyond the minimum distance." },
  { key: "maximum_delivery_radius_km", label: "Maximum Delivery Radius", suffix: "km", hint: "Orders outside this radius are rejected with a service-unavailable message." },
  { key: "free_delivery_threshold", label: "Free Delivery Threshold", suffix: "₹", hint: "Order subtotal at or above this ships free (if free delivery is enabled)." },
  { key: "default_seller_lat", label: "Default Seller Latitude", suffix: "°", hint: "Used as a fallback when a seller has no address_lat configured." },
  { key: "default_seller_lng", label: "Default Seller Longitude", suffix: "°", hint: "Used as a fallback when a seller has no address_lng configured." },
];

const num = (v: any): number | null => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

export default function RulesPage() {
  const toast = useToast();
  const [rules, setRules] = useState<Rules | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [slabs, setSlabs] = useState<WeightSlab[]>([]);
  const [freeEnabled, setFreeEnabled] = useState(true);
  const [riderModel, setRiderModel] = useState("hybrid");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Rules>("/business-rules");
      setRules(r);
      const f: Record<string, string> = {};
      [...GENERAL_FIELDS, ...DELIVERY_FIELDS, ...RIDER_FIELDS].forEach((fd) => { f[fd.key as string] = String((r as any)[fd.key] ?? ""); });
      setForm(f);
      setSlabs(Array.isArray(r.weight_charge_rules) ? r.weight_charge_rules : []);
      setFreeEnabled(!!r.is_free_delivery_enabled);
      setRiderModel(r.rider_payment_model || "hybrid");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const body: any = {};

    // General fields
    for (const fd of GENERAL_FIELDS) {
      const v = form[fd.key as string];
      if (fd.numeric) {
        const n = num(v);
        if (n == null || n < 0) { toast.error(`${fd.label} must be a valid non-negative number`); return; }
        body[fd.key] = n;
      } else {
        body[fd.key] = v;
      }
    }

    // Delivery-engine numeric fields
    for (const fd of DELIVERY_FIELDS) {
      const n = num(form[fd.key as string]);
      if (n == null) { toast.error(`${fd.label} must be a valid number`); return; }
      body[fd.key] = n;
    }

    // Range cross-check (client-side; server also validates)
    if (body.maximum_delivery_radius_km <= body.minimum_delivery_distance_km) {
      toast.error("Maximum Delivery Radius must be greater than Minimum Delivery Distance");
      return;
    }

    body.is_free_delivery_enabled = freeEnabled;
    if (freeEnabled && body.free_delivery_threshold <= 0) {
      toast.error("Free Delivery Threshold must be greater than 0 when free delivery is enabled");
      return;
    }

    // Rider Payment Model (Point 4)
    body.rider_payment_model = riderModel;
    for (const fd of RIDER_FIELDS) {
      const n = num(form[fd.key as string]);
      if (n == null || n < 0) { toast.error(`${fd.label} must be a valid non-negative number`); return; }
      body[fd.key] = n;
    }

    // Weight slabs — validate & serialise
    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i];
      if (s.min_kg < 0 || s.charge < 0) { toast.error(`Slab #${i + 1}: values cannot be negative`); return; }
      if (s.max_kg !== null && s.max_kg <= s.min_kg) { toast.error(`Slab #${i + 1}: Max must be greater than Min`); return; }
    }
    const sortedSlabs = [...slabs].sort((a, b) => a.min_kg - b.min_kg);
    for (let i = 0; i < sortedSlabs.length - 1; i++) {
      if (sortedSlabs[i].max_kg === null) { toast.error("Only the LAST slab may have an open-ended Max (leave blank)"); return; }
      if (sortedSlabs[i + 1].min_kg < (sortedSlabs[i].max_kg as number)) {
        toast.error(`Weight slabs overlap around ${sortedSlabs[i].max_kg} kg`);
        return;
      }
    }
    body.weight_charge_rules = sortedSlabs;

    setSaving(true);
    try {
      const r = await api<Rules>("/business-rules", { method: "PATCH", body });
      setRules(r);
      toast.success("Business rules updated");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const addSlab = () => setSlabs([...slabs, { min_kg: 0, max_kg: 0, charge: 0 }]);
  const removeSlab = (idx: number) => setSlabs(slabs.filter((_, i) => i !== idx));
  const updateSlab = (idx: number, patch: Partial<WeightSlab>) => setSlabs(slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  if (loading || !rules) return <Text style={{ padding: 24, color: theme.colors.textMuted }}>Loading…</Text>;

  return (
    <View style={{ gap: 16 }} testID="rules-screen">
      <View style={styles.banner}>
        <Feather name="info" size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Business Rules Engine</Text>
          <Text style={styles.bannerSub}>Every setting below is read live by the backend engines. Changes take effect immediately on new orders — no app update required.</Text>
        </View>
      </View>

      {/* --- Enterprise Delivery Charge Engine --- */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.sectionIcon}><Feather name="truck" size={16} color={theme.colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Enterprise Delivery Charge Engine</Text>
            <Text style={styles.cardSub}>Every delivery charge = Minimum + (Extra KM × Per KM) + Weight Slab + Bulky Item Charges. Free delivery threshold overrides all when order subtotal qualifies.</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {DELIVERY_FIELDS.map((f) => (
            <View key={f.key as string} style={styles.field}>
              <View style={styles.row}>
                <Input
                  label={f.label}
                  value={form[f.key as string] || ""}
                  onChangeText={(v) => setForm({ ...form, [f.key as string]: v })}
                  keyboardType="decimal-pad"
                  containerStyle={{ flex: 1 }}
                  testID={`rules-${f.key}`}
                />
                <Text style={styles.suffix}>{f.suffix}</Text>
              </View>
              <Text style={styles.hint}>{f.hint}</Text>
            </View>
          ))}
        </View>

        <View style={styles.freeToggle} testID="free-delivery-toggle-row">
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Enable Free Delivery</Text>
            <Text style={styles.hint}>When off, the free-delivery threshold above is ignored and every order pays the full engine charge.</Text>
          </View>
          <Switch
            value={freeEnabled}
            onValueChange={setFreeEnabled}
            trackColor={{ false: "#D4D4D8", true: theme.colors.primary }}
            thumbColor="#fff"
            testID="free-delivery-switch"
          />
        </View>
      </View>

      {/* --- Weight Slabs --- */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.sectionIcon}><Feather name="package" size={16} color={theme.colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Weight-Based Delivery Charges</Text>
            <Text style={styles.cardSub}>Total order weight is calculated automatically from each product's Weight (kg). The matching slab charge is added to the delivery fee. Leave Max blank on the LAST slab for "and above".</Text>
          </View>
        </View>

        <View style={styles.slabHeader}>
          <Text style={styles.slabHeaderCell}>MIN (KG)</Text>
          <Text style={styles.slabHeaderCell}>MAX (KG)</Text>
          <Text style={styles.slabHeaderCell}>CHARGE (₹)</Text>
          <View style={{ width: 40 }} />
        </View>

        {slabs.map((s, i) => (
          <View key={i} style={styles.slabRow} testID={`slab-row-${i}`}>
            <Input
              value={String(s.min_kg ?? "")}
              onChangeText={(v) => updateSlab(i, { min_kg: Number(v) || 0 })}
              keyboardType="decimal-pad"
              containerStyle={{ flex: 1 }}
              testID={`slab-${i}-min`}
            />
            <Input
              value={s.max_kg == null ? "" : String(s.max_kg)}
              onChangeText={(v) => updateSlab(i, { max_kg: v === "" ? null : Number(v) })}
              keyboardType="decimal-pad"
              placeholder="∞ (open-ended)"
              containerStyle={{ flex: 1 }}
              testID={`slab-${i}-max`}
            />
            <Input
              value={String(s.charge ?? "")}
              onChangeText={(v) => updateSlab(i, { charge: Number(v) || 0 })}
              keyboardType="decimal-pad"
              containerStyle={{ flex: 1 }}
              testID={`slab-${i}-charge`}
            />
            <Pressable onPress={() => removeSlab(i)} style={styles.trash} testID={`slab-${i}-remove`}>
              <Feather name="trash-2" size={14} color={theme.colors.danger} />
            </Pressable>
          </View>
        ))}

        <Button size="sm" variant="outline" title="+ Add Slab" onPress={addSlab} style={{ alignSelf: "flex-start" }} testID="add-slab-button" />
      </View>

      {/* --- Enterprise Rider Payment Model (Point 4) --- */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.sectionIcon}><Feather name="user" size={16} color={theme.colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Enterprise Rider Payment Model</Text>
            <Text style={styles.cardSub}>Drives per-delivery earnings for every rider. Applied automatically the moment a delivery is verified. Changing the model affects future deliveries only.</Text>
          </View>
        </View>

        <View style={{ maxWidth: 320 }}>
          <Select
            label="Payment Model"
            value={riderModel}
            onChange={setRiderModel}
            options={[
              { label: "Per Delivery (flat base only)", value: "per_delivery" },
              { label: "Per KM (distance only)", value: "per_km" },
              { label: "Hybrid (base + per-km)", value: "hybrid" },
              { label: "Salary (fixed monthly, ₹0 per delivery)", value: "salary" },
            ]}
            testID="rider-model-select"
          />
        </View>

        <View style={styles.grid}>
          {RIDER_FIELDS.map((f) => (
            <View key={f.key as string} style={styles.field}>
              <View style={styles.row}>
                <Input
                  label={f.label}
                  value={form[f.key as string] || ""}
                  onChangeText={(v) => setForm({ ...form, [f.key as string]: v })}
                  keyboardType="decimal-pad"
                  containerStyle={{ flex: 1 }}
                  testID={`rules-${f.key}`}
                />
                {f.suffix ? <Text style={styles.suffix}>{f.suffix}</Text> : null}
              </View>
              <Text style={styles.hint}>{f.hint}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* --- General settings --- */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.sectionIcon}><Feather name="sliders" size={16} color={theme.colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>General &amp; Verification</Text>
            <Text style={styles.cardSub}>Platform-wide fallbacks used across the customer, seller and rider apps.</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {GENERAL_FIELDS.map((f) => (
            <View key={f.key as string} style={styles.field}>
              <View style={styles.row}>
                <Input
                  label={f.label}
                  value={form[f.key as string] || ""}
                  onChangeText={(v) => setForm({ ...form, [f.key as string]: v })}
                  keyboardType={f.numeric ? "decimal-pad" : "default"}
                  containerStyle={{ flex: 1 }}
                  testID={`rules-${f.key}`}
                />
                {f.suffix ? <Text style={styles.suffix}>{f.suffix}</Text> : null}
              </View>
              {f.hint ? <Text style={styles.hint}>{f.hint}</Text> : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footerBar}>
        <Button title="Reset" variant="outline" onPress={load} />
        <Button title={saving ? "Saving…" : "Save All Changes"} onPress={save} loading={saving} testID="rules-save-button" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 24,
    gap: 20,
  },
  cardHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sectionIcon: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontFamily: theme.fonts.heading, fontSize: 15, fontWeight: "700", color: theme.colors.text },
  cardSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 18 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  field: {
    width: "48%",
    minWidth: 280,
    gap: 4,
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  suffix: {
    fontFamily: theme.fonts.mono, fontSize: 13,
    color: theme.colors.textMuted,
    paddingBottom: 12, fontWeight: "600",
  },
  hint: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, lineHeight: 16 },

  freeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 16,
  },
  toggleLabel: { fontFamily: theme.fonts.body, fontWeight: "700", fontSize: 13, color: theme.colors.text },

  slabHeader: {
    flexDirection: "row", gap: 8,
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  slabHeaderCell: {
    flex: 1, fontFamily: theme.fonts.body, fontSize: 11, fontWeight: "700",
    color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8,
  },
  slabRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  trash: {
    width: 40, alignItems: "center", justifyContent: "center",
    paddingBottom: 10,
  },
  footerBar: {
    flexDirection: "row", justifyContent: "flex-end", gap: 8,
    paddingVertical: 8,
  },
});
