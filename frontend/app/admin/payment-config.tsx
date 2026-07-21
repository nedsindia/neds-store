import React, { useCallback, useEffect, useState } from "react";
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

type PaymentAccount = {
  id: string;
  type: "bank" | "upi";
  holder_name: string;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  upi_id?: string | null;
  label?: string | null;
  is_primary: boolean;
  active: boolean;
};

type PaymentMethodsCfg = {
  cod_enabled: boolean;
  cod_limit: number;
  upi_intent_enabled: boolean;
  phonepe_enabled: boolean;
};

const EMPTY_FORM = {
  id: null as string | null,
  type: "upi" as "bank" | "upi",
  holder_name: "",
  bank_name: "",
  account_number: "",
  ifsc: "",
  upi_id: "",
  label: "",
  is_primary: false,
};

export default function PaymentConfigPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Payment method toggles + COD limit
  const [cfg, setCfg] = useState<PaymentMethodsCfg>({
    cod_enabled: true, cod_limit: 5000, upi_intent_enabled: true, phonepe_enabled: true,
  });
  const [savingCfg, setSavingCfg] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accts, rules] = await Promise.all([
        api<{ items: PaymentAccount[] }>("/payment-accounts"),
        api<any>("/business-rules"),
      ]);
      setRows(accts.items);
      setCfg({
        cod_enabled: !!rules.cod_enabled,
        cod_limit: Number(rules.cod_limit ?? 5000),
        upi_intent_enabled: !!rules.upi_intent_enabled,
        phonepe_enabled: !!rules.phonepe_enabled,
      });
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setModal(true); };
  const openEdit = async (a: PaymentAccount) => {
    // Fetch FULL details (unmasked account number) — list view is masked for safety
    try {
      const full = await api<PaymentAccount>(`/payment-accounts/${a.id}`);
      setForm({
        id: full.id,
        type: full.type,
        holder_name: full.holder_name,
        bank_name: full.bank_name || "",
        account_number: full.account_number || "",
        ifsc: full.ifsc || "",
        upi_id: full.upi_id || "",
        label: full.label || "",
        is_primary: full.is_primary,
      });
      setModal(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const submit = async () => {
    if (!form.holder_name.trim()) { toast.error("Holder name required"); return; }
    if (form.type === "bank") {
      if (!form.bank_name.trim() || !form.account_number.trim() || !form.ifsc.trim()) {
        toast.error("Bank Name, Account Number and IFSC are required for bank accounts"); return;
      }
    } else {
      if (!form.upi_id.trim()) { toast.error("UPI ID is required"); return; }
    }

    setSaving(true);
    try {
      const body: any = {
        holder_name: form.holder_name,
        label: form.label || null,
        is_primary: form.is_primary,
      };
      if (form.type === "bank") {
        body.bank_name = form.bank_name;
        body.account_number = form.account_number;
        body.ifsc = form.ifsc.toUpperCase();
      } else {
        body.upi_id = form.upi_id;
      }
      if (form.id) {
        await api(`/payment-accounts/${form.id}`, { method: "PATCH", body });
        toast.success("Payment account updated");
      } else {
        body.type = form.type;
        await api("/payment-accounts", { method: "POST", body });
        toast.success("Payment account created");
      }
      setModal(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const setPrimary = async (a: PaymentAccount) => {
    try {
      await api(`/payment-accounts/${a.id}/set-primary`, { method: "POST" });
      toast.success(`${a.label || a.holder_name} is now the primary payment account`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleActive = async (a: PaymentAccount) => {
    try {
      if (a.active) await api(`/payment-accounts/${a.id}`, { method: "DELETE" });
      else await api(`/payment-accounts/${a.id}`, { method: "PATCH", body: { active: true } });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const saveCfg = async () => {
    if (cfg.cod_enabled && cfg.cod_limit <= 0) { toast.error("COD Limit must be greater than 0 when COD is enabled"); return; }
    setSavingCfg(true);
    try {
      await api("/business-rules", { method: "PATCH", body: cfg });
      toast.success("Payment method configuration saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingCfg(false); }
  };

  const mask = (num?: string | null) => {
    if (!num) return "—";
    if (num.length <= 4) return num;
    return "•".repeat(Math.max(0, num.length - 4)) + num.slice(-4);
  };

  const columns: Column<PaymentAccount>[] = [
    { key: "type", label: "Type", flex: 0.7, render: (a) => (
      <Badge variant={a.type === "upi" ? "info" : "accepted"}>{a.type.toUpperCase()}</Badge>
    )},
    { key: "holder", label: "Holder / Label", flex: 1.6, render: (a) => (
      <View>
        <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", color: theme.colors.text, fontSize: 13 }}>{a.holder_name}</Text>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textMuted, fontSize: 12 }}>{a.label || "—"}</Text>
      </View>
    )},
    { key: "identifier", label: "Identifier", flex: 1.6, render: (a) => (
      a.type === "upi"
        ? <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, color: theme.colors.text }}>{a.upi_id}</Text>
        : (
          <View>
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, color: theme.colors.text }}>{mask(a.account_number)}</Text>
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{a.bank_name} · {a.ifsc}</Text>
          </View>
        )
    )},
    { key: "is_primary", label: "Primary", flex: 0.9, render: (a) => (
      a.is_primary
        ? <Badge variant="success">Primary</Badge>
        : <Button size="sm" variant="outline" title="Set primary" onPress={() => setPrimary(a)} testID={`set-primary-${a.id}`} />
    )},
    { key: "active", label: "Status", flex: 0.8, render: (a) => <Badge variant={a.active ? "active" : "inactive"}>{a.active ? "Active" : "Disabled"}</Badge> },
    { key: "actions", label: "", flex: 1.1, align: "right", render: (a) => (
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button size="sm" variant="outline" title="Edit" onPress={() => openEdit(a)} testID={`account-edit-${a.id}`} />
        <Button size="sm" variant={a.active ? "outline" : "primary"} title={a.active ? "Disable" : "Enable"} onPress={() => toggleActive(a)} />
      </View>
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="payment-config-screen">
      <View style={styles.banner}>
        <Feather name="shield" size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Enterprise Payment Configuration</Text>
          <Text style={styles.bannerSub}>
            Configure which payment methods are available to customers, set the Cash on Delivery limit,
            and manage the company&apos;s bank &amp; UPI accounts used for settlements. The customer app
            only shows methods that are enabled here.
          </Text>
        </View>
      </View>

      {/* Prominent admin note — PhonePe placeholder mode (Point 6) */}
      <View style={styles.warnBanner} testID="phonepe-placeholder-banner">
        <Feather name="alert-circle" size={16} color="#92400E" />
        <View style={{ flex: 1 }}>
          <Text style={styles.warnTitle}>PhonePe Gateway is running in PLACEHOLDER MODE</Text>
          <Text style={styles.warnSub}>
            Live PhonePe merchant credentials have not been configured yet. The gateway currently
            returns a synthetic checkout URL and auto-completes test payments after ~5 seconds so
            the checkout flow can be validated end-to-end. Live credentials will be added later —
            no code change will be required.
          </Text>
        </View>
      </View>

      {/* Payment Method Toggles */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.sectionIcon}><Feather name="toggle-right" size={16} color={theme.colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Payment Method Availability</Text>
            <Text style={styles.cardSub}>Enable or disable each method platform-wide. Changes take effect immediately for new orders.</Text>
          </View>
        </View>

        <View style={styles.methodRow} testID="method-cod-row">
          <View style={{ flex: 1 }}>
            <Text style={styles.methodTitle}>Cash on Delivery (COD)</Text>
            <Text style={styles.methodSub}>Customers pay in cash to the rider at delivery time.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 180 }}>
              <Input
                value={String(cfg.cod_limit)}
                onChangeText={(v) => setCfg({ ...cfg, cod_limit: Number(v.replace(/[^0-9.]/g, "")) || 0 })}
                keyboardType="decimal-pad"
                label="COD Limit (₹)"
                testID="cod-limit-input"
              />
            </View>
            <Switch
              value={cfg.cod_enabled}
              onValueChange={(v) => setCfg({ ...cfg, cod_enabled: v })}
              trackColor={{ false: "#D4D4D8", true: theme.colors.primary }}
              thumbColor="#fff"
              testID="cod-switch"
            />
          </View>
        </View>

        <View style={styles.methodRow} testID="method-upi-row">
          <View style={{ flex: 1 }}>
            <Text style={styles.methodTitle}>UPI Intent</Text>
            <Text style={styles.methodSub}>Deep-link into GPay / PhonePe / Paytm from the customer app to pay to the primary UPI account.</Text>
          </View>
          <Switch
            value={cfg.upi_intent_enabled}
            onValueChange={(v) => setCfg({ ...cfg, upi_intent_enabled: v })}
            trackColor={{ false: "#D4D4D8", true: theme.colors.primary }}
            thumbColor="#fff"
            testID="upi-switch"
          />
        </View>

        <View style={styles.methodRow} testID="method-phonepe-row">
          <View style={{ flex: 1 }}>
            <Text style={styles.methodTitle}>PhonePe Payment Gateway</Text>
            <Text style={styles.methodSub}>Standard Checkout — UPI, Card, NetBanking. Currently running in placeholder mode until production keys are added.</Text>
          </View>
          <Switch
            value={cfg.phonepe_enabled}
            onValueChange={(v) => setCfg({ ...cfg, phonepe_enabled: v })}
            trackColor={{ false: "#D4D4D8", true: theme.colors.primary }}
            thumbColor="#fff"
            testID="phonepe-switch"
          />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingTop: 4 }}>
          <Button title={savingCfg ? "Saving…" : "Save Method Settings"} onPress={saveCfg} loading={savingCfg} testID="save-method-cfg" />
        </View>
      </View>

      {/* Payment Accounts */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.sectionIcon}><Feather name="credit-card" size={16} color={theme.colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Company Bank &amp; UPI Accounts</Text>
            <Text style={styles.cardSub}>Settlement receiving accounts. **Only ONE primary account is allowed across all types** — it&apos;s the one used for automated payouts. Account numbers are shown masked (XXXXXXXX1234) in this list; the full value is available in the Edit modal (view is audit-logged).</Text>
          </View>
          <Button title="+ Add Account" onPress={openCreate} testID="add-account-button" />
        </View>

        <DataTable columns={columns} rows={rows} loading={loading} empty="No payment accounts yet." testID="accounts-table" />
      </View>

      <ModalCard visible={modal} onClose={() => setModal(false)} title={form.id ? "Edit Payment Account" : "Add Payment Account"} width={560}>
        {!form.id && (
          <Select
            label="Account Type"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v as "bank" | "upi" })}
            options={[{ label: "UPI", value: "upi" }, { label: "Bank", value: "bank" }]}
            testID="account-type-select"
          />
        )}
        <Input label="Account Holder Name" value={form.holder_name} onChangeText={(v) => setForm({ ...form, holder_name: v })} testID="acct-holder-name" />
        <Input label="Label (optional)" value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} placeholder="e.g. Primary UPI" />
        {form.type === "upi" ? (
          <Input label="UPI ID" value={form.upi_id} onChangeText={(v) => setForm({ ...form, upi_id: v })} placeholder="name@handle" autoCapitalize="none" testID="acct-upi" />
        ) : (
          <>
            <Input label="Bank Name" value={form.bank_name} onChangeText={(v) => setForm({ ...form, bank_name: v })} testID="acct-bank" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Input label="Account Number" value={form.account_number} onChangeText={(v) => setForm({ ...form, account_number: v.replace(/\D/g, "") })} keyboardType="number-pad" containerStyle={{ flex: 1 }} testID="acct-number" />
              <Input label="IFSC" value={form.ifsc} onChangeText={(v) => setForm({ ...form, ifsc: v.toUpperCase().replace(/[^A-Z0-9]/g, "") })} containerStyle={{ flex: 1 }} maxLength={11} testID="acct-ifsc" />
            </View>
          </>
        )}
        <View style={styles.primaryToggle}>
          <View style={{ flex: 1 }}>
            <Text style={styles.methodTitle}>Set as Primary Payment Account</Text>
            <Text style={styles.methodSub}>Only ONE payment account can be primary at a time across all accounts. Enabling this will auto-demote any other primary.</Text>
          </View>
          <Switch
            value={form.is_primary}
            onValueChange={(v) => setForm({ ...form, is_primary: v })}
            trackColor={{ false: "#D4D4D8", true: theme.colors.primary }}
            thumbColor="#fff"
            testID="acct-is-primary"
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
          <Button title={saving ? "Saving…" : form.id ? "Save Changes" : "Create"} onPress={submit} loading={saving} testID="save-account" />
        </View>
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", gap: 12, padding: 16,
    borderRadius: theme.radius.md, backgroundColor: theme.colors.primaryLight,
    borderWidth: 1, borderColor: "#A7F3D0",
  },
  bannerTitle: { fontFamily: theme.fonts.heading, fontWeight: "700", color: "#065F46", fontSize: 14 },
  bannerSub: { fontFamily: theme.fonts.body, color: "#065F46", fontSize: 12, marginTop: 2, lineHeight: 18 },
  warnBanner: {
    flexDirection: "row", gap: 12, padding: 16,
    borderRadius: theme.radius.md, backgroundColor: "#FEF3C7",
    borderWidth: 1, borderColor: "#FDE68A",
  },
  warnTitle: { fontFamily: theme.fonts.heading, fontWeight: "700", color: "#92400E", fontSize: 14 },
  warnSub: { fontFamily: theme.fonts.body, color: "#92400E", fontSize: 12, marginTop: 2, lineHeight: 18 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: 24, gap: 16,
  },
  cardHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sectionIcon: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontFamily: theme.fonts.heading, fontSize: 15, fontWeight: "700", color: theme.colors.text },
  cardSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 18 },
  methodRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderTopWidth: 1, borderTopColor: theme.colors.borderLight, paddingTop: 14,
  },
  methodTitle: { fontFamily: theme.fonts.body, fontWeight: "700", fontSize: 13, color: theme.colors.text },
  methodSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 18 },
  primaryToggle: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1, borderColor: theme.colors.border,
  },
});
