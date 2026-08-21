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

type ReturnRequest = {
  id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  description?: string | null;
  items: any[];
  refund_amount: number;
  status: string;
  admin_note?: string | null;
  created_at: string;
};

type Cancellation = {
  id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  refund_amount: number;
  was_paid: boolean;
  status: string;
  created_at: string;
};

type Refund = {
  id: string;
  order_id: string;
  return_id?: string | null;
  cancellation_id?: string | null;
  amount_inr: number;
  status: string;
  payout_reference?: string | null;
  created_at: string;
};

type Summary = {
  total_returns: number;
  pending_returns: number;
  completed_returns: number;
  total_cancellations: number;
  total_refunds: number;
  total_refund_amount: number;
};

const TABS = ["Returns", "Cancellations", "Refunds"] as const;
type Tab = typeof TABS[number];

const fmtINR = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function ReturnsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Returns");
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [cancels, setCancels] = useState<Cancellation[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [statusUpdate, setStatusUpdate] = useState({ status: "", note: "" });
  const [refundModal, setRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: "", reference: "", notes: "" });
  const [refundContext, setRefundContext] = useState<{ return_id?: string; cancellation_id?: string; order_id?: string; suggested: number }>({ suggested: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes, fRes, sRes] = await Promise.all([
        api<{ items: ReturnRequest[] }>("/returns"),
        api<{ items: Cancellation[] }>("/cancellations"),
        api<{ items: Refund[] }>("/refunds"),
        api<Summary>("/returns-summary"),
      ]);
      setReturns(rRes.items);
      setCancels(cRes.items);
      setRefunds(fRes.items);
      setSummary(sRes);
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openReturn = async (r: ReturnRequest) => {
    try {
      const full = await api<ReturnRequest>(`/returns/${r.id}`);
      setSelectedReturn(full);
      setStatusUpdate({ status: "", note: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const updateReturnStatus = async () => {
    if (!selectedReturn || !statusUpdate.status) return;
    setSaving(true);
    try {
      await api(`/returns/${selectedReturn.id}/status`, {
        method: "PATCH",
        body: { status: statusUpdate.status, admin_note: statusUpdate.note || null },
      });
      toast.success(`Return marked ${statusUpdate.status}`);
      setSelectedReturn(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const updateCancellation = async (id: string, status: string) => {
    try {
      await api(`/cancellations/${id}/status`, { method: "PATCH", body: { status } });
      toast.success(`Cancellation ${status}`);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openRefundModal = (ctx: { return_id?: string; cancellation_id?: string; order_id?: string; suggested: number }) => {
    setRefundContext(ctx);
    setRefundForm({ amount: String(ctx.suggested || ""), reference: "", notes: "" });
    setRefundModal(true);
  };

  const issueRefund = async () => {
    const amount = parseFloat(refundForm.amount);
    if (!amount || amount <= 0) return toast.error("Enter refund amount");
    setSaving(true);
    try {
      await api("/refunds", {
        method: "POST",
        body: {
          amount_inr: amount,
          reason: "Manual refund",
          return_id: refundContext.return_id,
          cancellation_id: refundContext.cancellation_id,
          order_id: refundContext.order_id,
          payout_reference: refundForm.reference || null,
          notes: refundForm.notes || null,
        },
      });
      toast.success("Refund issued");
      setRefundModal(false);
      setSelectedReturn(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const returnCols: Column<ReturnRequest>[] = useMemo(() => [
    { key: "id", label: "Return ID", flex: 1.2, render: (r) => <Text style={styles.mono}>{r.id.substring(0, 8)}</Text> },
    { key: "order", label: "Order", flex: 1, render: (r) => <Text style={styles.mono}>{r.order_id.substring(0, 8)}</Text> },
    { key: "reason", label: "Reason", flex: 1, render: (r) => <Text style={styles.txt}>{r.reason.replace(/_/g, " ")}</Text> },
    { key: "amount", label: "Refund ₹", flex: 0.8, align: "right", render: (r) => <Text style={styles.txt}>{fmtINR(r.refund_amount)}</Text> },
    { key: "status", label: "Status", flex: 1, render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    { key: "date", label: "Created", flex: 1, render: (r) => <Text style={styles.txt}>{fmtDate(r.created_at)}</Text> },
    { key: "actions", label: "", flex: 0.5, render: (r) => <Button title="View" variant="outline" size="sm" onPress={() => openReturn(r)} /> },
  ], []);

  const cancelCols: Column<Cancellation>[] = useMemo(() => [
    { key: "id", label: "Cancel ID", flex: 1.2, render: (c) => <Text style={styles.mono}>{c.id.substring(0, 8)}</Text> },
    { key: "order", label: "Order", flex: 1, render: (c) => <Text style={styles.mono}>{c.order_id.substring(0, 8)}</Text> },
    { key: "reason", label: "Reason", flex: 1, render: (c) => <Text style={styles.txt}>{c.reason.replace(/_/g, " ")}</Text> },
    { key: "paid", label: "Was Paid", flex: 0.7, render: (c) => <Badge variant={c.was_paid ? "warning" : "inactive"}>{c.was_paid ? "Yes" : "No"}</Badge> },
    { key: "amount", label: "Refund ₹", flex: 0.8, align: "right", render: (c) => <Text style={styles.txt}>{fmtINR(c.refund_amount)}</Text> },
    { key: "status", label: "Status", flex: 1, render: (c) => <Badge variant={statusVariant(c.status)}>{c.status}</Badge> },
    { key: "actions", label: "", flex: 1.5, render: (c) => (
      <View style={{ flexDirection: "row", gap: 6 }}>
        {c.status === "requested" ? (
          <>
            <Button title="Approve" size="sm" onPress={() => updateCancellation(c.id, "approved")} />
            <Button title="Reject" size="sm" variant="outline" onPress={() => updateCancellation(c.id, "rejected")} />
          </>
        ) : null}
        {c.status === "approved" ? (
          <>
            <Button title="Complete" size="sm" onPress={() => updateCancellation(c.id, "completed")} />
            {c.was_paid ? (
              <Button title="Refund" size="sm" variant="outline"
                onPress={() => openRefundModal({ cancellation_id: c.id, order_id: c.order_id, suggested: c.refund_amount })} />
            ) : null}
          </>
        ) : null}
      </View>
    ) },
  ], []);

  const refundCols: Column<Refund>[] = useMemo(() => [
    { key: "id", label: "Refund ID", flex: 1.2, render: (r) => <Text style={styles.mono}>{r.id.substring(0, 8)}</Text> },
    { key: "order", label: "Order", flex: 1, render: (r) => <Text style={styles.mono}>{r.order_id.substring(0, 8)}</Text> },
    { key: "amount", label: "Amount", flex: 1, align: "right", render: (r) => <Text style={styles.txt}>{fmtINR(r.amount_inr)}</Text> },
    { key: "type", label: "Type", flex: 0.8, render: (r) => <Text style={styles.txt}>{r.return_id ? "Return" : r.cancellation_id ? "Cancellation" : "Direct"}</Text> },
    { key: "ref", label: "UTR / Ref", flex: 1.2, render: (r) => <Text style={styles.mono}>{r.payout_reference || "—"}</Text> },
    { key: "status", label: "Status", flex: 1, render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    { key: "date", label: "Date", flex: 1, render: (r) => <Text style={styles.txt}>{fmtDate(r.created_at)}</Text> },
  ], []);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={styles.title}>Returns, Refunds & Cancellations</Text>
        <Text style={styles.subtitle}>
          Manage returns for delivered orders, cancellations for pre-delivery orders, and payment refunds.
        </Text>
      </View>

      {/* KPIs */}
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <KpiCard title="Total Returns" value={summary?.total_returns ?? "—"} accent={theme.colors.primary} />
        <KpiCard title="Pending Returns" value={summary?.pending_returns ?? "—"} accent="#F59E0B" />
        <KpiCard title="Cancellations" value={summary?.total_cancellations ?? "—"} accent="#3B82F6" />
        <KpiCard title="Total Refunds" value={summary?.total_refunds ?? "—"} accent="#8B5CF6" />
        <KpiCard title="Refunded ₹" value={fmtINR(summary?.total_refund_amount)} accent="#EF4444" />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, t === tab && styles.tabActive]}>
            <Text style={[styles.tabText, t === tab && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "Returns" ? (
        <DataTable columns={returnCols} rows={returns} loading={loading} empty="No returns yet" />
      ) : tab === "Cancellations" ? (
        <DataTable columns={cancelCols} rows={cancels} loading={loading} empty="No cancellations yet" />
      ) : (
        <DataTable columns={refundCols} rows={refunds} loading={loading} empty="No refunds issued yet" />
      )}

      {/* Return Detail Modal */}
      <ModalCard
        visible={!!selectedReturn}
        onClose={() => setSelectedReturn(null)}
        title={selectedReturn ? `Return · ${selectedReturn.id.substring(0, 8)}` : ""}
        width={720}
      >
        {selectedReturn ? (
          <View style={{ gap: 14 }}>
            <View style={styles.detailGrid}>
              <DetailItem label="Order ID" value={selectedReturn.order_id.substring(0, 12)} />
              <DetailItem label="Customer" value={selectedReturn.customer_id.substring(0, 12)} />
              <DetailItem label="Reason" value={selectedReturn.reason.replace(/_/g, " ")} />
              <DetailItem label="Refund Amount" value={fmtINR(selectedReturn.refund_amount)} />
              <DetailItem label="Status" value={selectedReturn.status} />
              <DetailItem label="Created" value={fmtDate(selectedReturn.created_at)} />
            </View>
            {selectedReturn.description ? (
              <View>
                <Text style={styles.label}>Customer Note</Text>
                <Text style={styles.paragraph}>{selectedReturn.description}</Text>
              </View>
            ) : null}
            {selectedReturn.admin_note ? (
              <View>
                <Text style={styles.label}>Admin Note</Text>
                <Text style={styles.paragraph}>{selectedReturn.admin_note}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Items ({selectedReturn.items.length})</Text>
            <View style={styles.itemsBox}>
              {selectedReturn.items.map((it: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={[styles.txt, { flex: 2 }]}>{it.name}</Text>
                  <Text style={[styles.txt, { flex: 0.5 }]}>×{it.qty}</Text>
                  <Text style={[styles.txt, { flex: 1, textAlign: "right" }]}>{fmtINR(it.line_total)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.label}>Update Status</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {["approved", "rejected", "pickup_scheduled", "picked_up", "refunded", "closed"].map((s) => (
                <Pressable key={s}
                  onPress={() => setStatusUpdate((u) => ({ ...u, status: s }))}
                  style={[styles.statusChip, statusUpdate.status === s && styles.statusChipActive]}>
                  <Text style={[styles.chipText, statusUpdate.status === s && { color: "#fff" }]}>{s.replace(/_/g, " ")}</Text>
                </Pressable>
              ))}
            </View>
            <Input label="Admin Note (optional)" value={statusUpdate.note} onChangeText={(v) => setStatusUpdate((u) => ({ ...u, note: v }))} />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Button title="Close" variant="outline" onPress={() => setSelectedReturn(null)} />
              <Button title="Issue Refund" variant="secondary"
                onPress={() => openRefundModal({ return_id: selectedReturn.id, order_id: selectedReturn.order_id, suggested: selectedReturn.refund_amount })} />
              <Button title="Update" onPress={updateReturnStatus} loading={saving} disabled={!statusUpdate.status} />
            </View>
          </View>
        ) : null}
      </ModalCard>

      {/* Refund Modal */}
      <ModalCard visible={refundModal} onClose={() => setRefundModal(false)} title="Issue Refund" width={480}>
        <View style={{ gap: 12 }}>
          <Input label="Amount (INR)" value={refundForm.amount} onChangeText={(v) => setRefundForm((f) => ({ ...f, amount: v }))} keyboardType="numeric" />
          <Input label="UTR / Transaction Reference" value={refundForm.reference} onChangeText={(v) => setRefundForm((f) => ({ ...f, reference: v }))} placeholder="e.g. UTR123456789" />
          <Input label="Notes" value={refundForm.notes} onChangeText={(v) => setRefundForm((f) => ({ ...f, notes: v }))} />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Button title="Cancel" variant="outline" onPress={() => setRefundModal(false)} />
            <Button title="Issue Refund" onPress={issueRefund} loading={saving} />
          </View>
        </View>
      </ModalCard>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 200, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function statusVariant(s: string): string {
  if (["requested", "pending", "processing"].includes(s)) return "warning";
  if (["approved", "pickup_scheduled", "picked_up"].includes(s)) return "info";
  if (["refunded", "completed"].includes(s)) return "success";
  if (["rejected", "failed", "cancelled"].includes(s)) return "danger";
  return "inactive";
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: theme.radius.md,
    padding: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.sm, cursor: "pointer" as any },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontFamily: theme.fonts.body, fontSize: 13, fontWeight: "500", color: theme.colors.textMuted },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  mono: { fontFamily: "monospace", fontSize: 12, color: theme.colors.text },
  txt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  label: { fontFamily: theme.fonts.body, fontSize: 11, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, textTransform: "capitalize" },
  paragraph: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, lineHeight: 20 },
  itemsBox: { backgroundColor: "#FAFAFA", borderRadius: theme.radius.md, padding: 12, gap: 6, borderWidth: 1, borderColor: theme.colors.border },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusChip: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, cursor: "pointer" as any },
  statusChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text, textTransform: "capitalize" },
});
