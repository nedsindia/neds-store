import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Rules = {
  commission_percent: number;
  delivery_radius_km: number;
  delivery_charge: number;
  free_delivery_above: number;
  min_order_amount: number;
  verification_radius_meters: number;
  platform_name: string;
  support_mobile: string;
};

const FIELDS: { key: keyof Rules; label: string; suffix?: string; hint?: string; numeric?: boolean }[] = [
  { key: "commission_percent", label: "Platform Commission", suffix: "%", numeric: true, hint: "Percentage deducted from each delivered order as platform fee." },
  { key: "delivery_radius_km", label: "Delivery Zone Radius", suffix: "km", numeric: true, hint: "Maximum distance from seller to customer for order acceptance." },
  { key: "delivery_charge", label: "Standard Delivery Charge", suffix: "₹", numeric: true, hint: "Applied to orders below the free-delivery threshold." },
  { key: "free_delivery_above", label: "Free Delivery Above", suffix: "₹", numeric: true, hint: "Orders at or above this subtotal ship for free." },
  { key: "min_order_amount", label: "Minimum Order Amount", suffix: "₹", numeric: true, hint: "Orders below this cannot be placed." },
  { key: "verification_radius_meters", label: "Delivery Verification Radius", suffix: "m", numeric: true, hint: "When the rider enters this radius around the customer, the verification code is auto-generated in the customer app." },
  { key: "platform_name", label: "Platform Name", hint: "Displayed across customer notifications and invoices." },
  { key: "support_mobile", label: "Support Contact Number", hint: "Displayed to customers for help." },
];

export default function RulesPage() {
  const toast = useToast();
  const [rules, setRules] = useState<Rules | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Rules>("/business-rules");
      setRules(r);
      const f: Record<string, string> = {};
      FIELDS.forEach((fd) => { f[fd.key as string] = String((r as any)[fd.key] ?? ""); });
      setForm(f);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const body: any = {};
    for (const fd of FIELDS) {
      const v = form[fd.key as string];
      if (fd.numeric) {
        const n = Number(v);
        if (isNaN(n) || n < 0) { toast.error(`${fd.label} must be a valid number`); return; }
        body[fd.key] = n;
      } else {
        body[fd.key] = v;
      }
    }
    setSaving(true);
    try {
      const r = await api<Rules>("/business-rules", { method: "PATCH", body });
      setRules(r);
      toast.success("Business rules updated");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading || !rules) return <Text style={{ padding: 24, color: theme.colors.textMuted }}>Loading…</Text>;

  return (
    <View style={{ gap: 16 }} testID="rules-screen">
      <View style={styles.banner}>
        <Feather name="info" size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Business Rules Engine</Text>
          <Text style={styles.bannerSub}>
            These settings drive the pricing, delivery zones, commissions and delivery-verification workflow across
            all customer, seller and rider apps. Changes take effect immediately on new orders.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.grid}>
          {FIELDS.map((f) => (
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

        <View style={styles.footer}>
          <Button title="Reset" variant="outline" onPress={load} />
          <Button title={saving ? "Saving…" : "Save Changes"} onPress={save} loading={saving} testID="rules-save-button" />
        </View>
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
    gap: 16,
  },
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
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.textMuted,
    paddingBottom: 12,
    fontWeight: "600",
  },
  hint: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, lineHeight: 16 },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 16,
    marginTop: 8,
  },
});
