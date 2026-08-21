import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

type Invoice = {
  id: string;
  invoice_number: string;
  order_id: string;
  issued_at: string;
  status: string;
  grand_total: number;
  total_gst: number;
  subtotal_taxable: number;
  buyer?: any;
  company?: any;
  lines?: any[];
};
type Summary = { total_invoices: number; cancelled_invoices: number; gross_billing: number; total_gst_collected: number };

const fmtINR = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function InvoicesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [q, setQ] = useState("");
  const [genOrderId, setGenOrderId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api<{ items: Invoice[] }>("/invoices", { query: { q: q || undefined } }),
        api<Summary>("/invoices/summary"),
      ]);
      setRows(r.items); setSummary(s);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [q, toast]);

  useEffect(() => { load(); }, [load]);

  const openInvoice = async (inv: Invoice) => {
    try {
      const full = await api<Invoice>(`/invoices/${inv.id}`);
      setSelected(full);
    } catch (e: any) { toast.error(e.message); }
  };

  const regenerate = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const inv = await api<Invoice>(`/invoices/${selected.id}/regenerate`, { method: "POST" });
      toast.success("Invoice regenerated");
      setSelected(inv);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const cancelInvoice = async () => {
    if (!selected) return;
    if (!window.confirm("Cancel this invoice? It will remain in history but marked as cancelled.")) return;
    try {
      await api(`/invoices/${selected.id}/cancel`, { method: "POST" });
      toast.success("Invoice cancelled");
      setSelected(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const generateForOrder = async () => {
    if (!genOrderId.trim()) return toast.error("Enter Order ID");
    setSaving(true);
    try {
      const inv = await api<Invoice>(`/invoices/generate/${genOrderId.trim()}`, { method: "POST" });
      toast.success(`Invoice ${inv.invoice_number} generated`);
      setGenOrderId("");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const cols: Column<Invoice>[] = useMemo(() => [
    { key: "num", label: "Invoice #", flex: 1.3, render: (r) => <Text style={styles.mono}>{r.invoice_number}</Text> },
    { key: "order", label: "Order", flex: 1, render: (r) => <Text style={styles.mono}>{r.order_id.substring(0, 8)}</Text> },
    { key: "date", label: "Issued", flex: 1, render: (r) => <Text style={styles.txt}>{fmtDate(r.issued_at)}</Text> },
    { key: "taxable", label: "Taxable ₹", flex: 0.8, align: "right", render: (r) => <Text style={styles.txt}>{fmtINR(r.subtotal_taxable)}</Text> },
    { key: "gst", label: "GST ₹", flex: 0.8, align: "right", render: (r) => <Text style={styles.txt}>{fmtINR(r.total_gst)}</Text> },
    { key: "total", label: "Grand Total", flex: 1, align: "right", render: (r) => <Text style={[styles.txt, { fontWeight: "700" }]}>{fmtINR(r.grand_total)}</Text> },
    { key: "status", label: "Status", flex: 0.8, render: (r) => <Badge variant={r.status === "issued" ? "success" : "danger"}>{r.status}</Badge> },
    { key: "act", label: "", flex: 0.7, render: (r) => <Button title="View" size="sm" variant="outline" onPress={() => openInvoice(r)} /> },
  ], []);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={styles.title}>Invoices & Billing</Text>
        <Text style={styles.subtitle}>Auto-generated on delivery. GST split (CGST/SGST/IGST) computed from product GST %.</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <KpiCard title="Total Invoices" value={summary?.total_invoices ?? "—"} accent={theme.colors.primary} />
        <KpiCard title="Gross Billing" value={fmtINR(summary?.gross_billing)} accent="#3B82F6" />
        <KpiCard title="GST Collected" value={fmtINR(summary?.total_gst_collected)} accent="#8B5CF6" />
        <KpiCard title="Cancelled" value={summary?.cancelled_invoices ?? "—"} accent="#EF4444" />
      </View>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Input value={q} onChangeText={setQ} placeholder="Search by invoice #..." />
        </View>
        <View style={{ width: 260 }}>
          <Input value={genOrderId} onChangeText={setGenOrderId} placeholder="Order ID to generate invoice for..." />
        </View>
        <Button title="Generate" onPress={generateForOrder} loading={saving} leftIcon={<Feather name="plus" size={14} color="#fff" />} />
      </View>

      <DataTable columns={cols} rows={rows} loading={loading} empty="No invoices yet — deliver an order to auto-generate one" />

      <ModalCard visible={!!selected} onClose={() => setSelected(null)} title={selected ? `Invoice ${selected.invoice_number}` : ""} width={800}>
        {selected ? (
          <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ gap: 12 }}>
            <View style={styles.invoiceHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>From (Company)</Text>
                <Text style={styles.big}>{selected.company?.name}</Text>
                <Text style={styles.small}>{selected.company?.address || "—"}</Text>
                <Text style={styles.small}>GSTIN: {selected.company?.gst_number || "—"} · PAN: {selected.company?.pan || "—"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>To (Buyer)</Text>
                <Text style={styles.big}>{selected.buyer?.name}</Text>
                <Text style={styles.small}>Mobile: {selected.buyer?.mobile}</Text>
                <Text style={styles.small}>{selected.buyer?.address || "—"}</Text>
              </View>
            </View>

            <Text style={styles.label}>Line Items</Text>
            <View style={styles.linesBox}>
              <View style={[styles.lineRow, { backgroundColor: "#F4F4F5", borderTopLeftRadius: 6, borderTopRightRadius: 6 }]}>
                <Text style={[styles.lineCell, { flex: 2 }]}>Item</Text>
                <Text style={[styles.lineCell, { flex: 0.7 }]}>HSN</Text>
                <Text style={[styles.lineCell, { flex: 0.5, textAlign: "right" }]}>Qty</Text>
                <Text style={[styles.lineCell, { flex: 0.8, textAlign: "right" }]}>Taxable</Text>
                <Text style={[styles.lineCell, { flex: 0.6, textAlign: "right" }]}>GST%</Text>
                <Text style={[styles.lineCell, { flex: 0.8, textAlign: "right" }]}>Total</Text>
              </View>
              {(selected.lines || []).map((l: any, i: number) => (
                <View key={i} style={styles.lineRow}>
                  <Text style={[styles.lineCell, { flex: 2 }]}>{l.name}</Text>
                  <Text style={[styles.lineCell, { flex: 0.7 }]}>{l.hsn_code || "—"}</Text>
                  <Text style={[styles.lineCell, { flex: 0.5, textAlign: "right" }]}>{l.qty}</Text>
                  <Text style={[styles.lineCell, { flex: 0.8, textAlign: "right" }]}>{fmtINR(l.taxable_amount)}</Text>
                  <Text style={[styles.lineCell, { flex: 0.6, textAlign: "right" }]}>{l.gst_percentage}%</Text>
                  <Text style={[styles.lineCell, { flex: 0.8, textAlign: "right", fontWeight: "600" }]}>{fmtINR(l.line_total)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.totalsBox}>
              <TotalRow label="Subtotal (Taxable)" value={fmtINR(selected.subtotal_taxable)} />
              {selected.total_cgst ? <TotalRow label="CGST" value={fmtINR(selected.total_cgst)} /> : null}
              {selected.total_sgst ? <TotalRow label="SGST" value={fmtINR(selected.total_sgst)} /> : null}
              {selected.total_igst ? <TotalRow label="IGST" value={fmtINR(selected.total_igst)} /> : null}
              <TotalRow label="Delivery Charge" value={fmtINR((selected as any).delivery_charge)} />
              <View style={styles.divider} />
              <TotalRow label="Grand Total" value={fmtINR(selected.grand_total)} bold />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Button title="Close" variant="outline" onPress={() => setSelected(null)} />
              <Button title="Regenerate" variant="secondary" onPress={regenerate} loading={saving} />
              {selected.status === "issued" ? (
                <Button title="Cancel Invoice" variant="danger" onPress={cancelInvoice} />
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </ModalCard>
    </View>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={[styles.small, bold && { fontWeight: "700", fontSize: 15 }]}>{label}</Text>
      <Text style={[styles.small, bold && { fontWeight: "700", fontSize: 15, color: theme.colors.primary }]}>{value}</Text>
    </View>
  );
}

// @ts-ignore for react-native-web
declare const window: any;

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  txt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  small: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text },
  mono: { fontFamily: "monospace", fontSize: 12, color: theme.colors.text },
  label: { fontFamily: theme.fonts.body, fontSize: 11, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  big: { fontFamily: theme.fonts.heading, fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 4 },
  invoiceHead: { flexDirection: "row", gap: 16, backgroundColor: "#FAFAFA", borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  linesBox: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, overflow: "hidden" },
  lineRow: { flexDirection: "row", padding: 8, borderTopWidth: 1, borderColor: theme.colors.border, gap: 4 },
  lineCell: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text },
  totalsBox: { padding: 12, backgroundColor: "#FAFAFA", borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 6 },
});
