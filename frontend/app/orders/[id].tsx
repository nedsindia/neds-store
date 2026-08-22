import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { PublicHeader } from "@/src/components/PublicHeader";
import { api } from "@/src/api/client";
import { theme, inr } from "@/src/theme";

const RETURN_REASONS = ["damaged", "wrong_item", "defective", "not_as_described", "changed_mind", "size_issue", "quality_issue", "expired", "missing_parts", "other"];
const ORDER_STEPS = ["placed", "accepted", "packed", "out_for_delivery", "delivered"];
const STATUS_LABELS: Record<string, string> = { placed: "Order Placed", accepted: "Order Accepted", packed: "Packed", out_for_delivery: "Out for Delivery", delivered: "Delivered" };

export default function OrderDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("damaged");
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"cancel" | "return" | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    try { setData(await api(`/customer/orders/${id}`)); }
    catch (e: any) { setError(e?.message || "Order load नहीं हुआ।"); }
  };
  useEffect(() => { load(); }, [id]);

  const submitAction = async () => {
    if (!id || !action) return;
    setSaving(true);
    try {
      if (action === "cancel") {
        await api("/cancellations", { method: "POST", body: { order_id: id, reason: reason, description: note || undefined } });
        Alert.alert("Cancellation requested", "आपकी cancellation request submit हो गई है।");
      } else {
        await api("/returns", { method: "POST", body: { order_id: id, reason, description: note || undefined } });
        Alert.alert("Return requested", "आपकी return request submit हो गई है।");
      }
      setAction(null); setNote(""); await load();
    } catch (e: any) { Alert.alert("Request failed", e?.message || "Request submit नहीं हो सकी।"); }
    finally { setSaving(false); }
  };

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  const o = data.order;
  const canCancel = ["placed", "accepted", "packed", "out_for_delivery"].includes(o.status);
  const canReturn = o.status === "delivered";
  const currentIndex = ORDER_STEPS.indexOf(o.status);

  return <View style={styles.page}>
    <PublicHeader />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Order #{String(o.id).slice(0, 8)}</Text>
      <View style={styles.card}>
        <Text style={styles.status}>{STATUS_LABELS[o.status] || String(o.status).replaceAll("_", " ")}</Text>
        <Text style={styles.sub}>Payment: {o.payment_method}</Text>
        <Text style={styles.sub}>Delivery: {o.delivery_address}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Track Order</Text>
        <View style={styles.timeline}>
          {ORDER_STEPS.map((step, index) => {
            const done = currentIndex >= index;
            const active = currentIndex === index;
            return <View key={step} style={styles.timelineItem}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}><Text style={styles.dotText}>{done ? "✓" : String(index + 1)}</Text></View>
              <View style={styles.timelineText}><Text style={[styles.timelineLabel, done && styles.timelineDone]}>{STATUS_LABELS[step]}</Text>{active ? <Text style={styles.sub}>Current status</Text> : null}</View>
              {index < ORDER_STEPS.length - 1 ? <View style={[styles.line, currentIndex > index && styles.lineDone]} /> : null}
            </View>;
          })}
        </View>
        <Text style={styles.sub}>Delivery: {data.delivery?.status || "Waiting for assignment"}</Text>
        {data.delivery?.rider_name ? <Text style={styles.sub}>Rider: {data.delivery.rider_name}</Text> : null}
        {data.delivery?.eta_minutes != null ? <Text style={styles.sub}>Estimated arrival: {data.delivery.eta_minutes} minutes</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {(o.items || []).map((i: any) => <View key={i.product_id} style={styles.row}><Text style={styles.sub}>{i.name} × {i.qty}</Text><Text>{inr(i.price * i.qty)}</Text></View>)}
        <View style={styles.totalRow}><Text style={styles.cardTitle}>Total</Text><Text style={styles.total}>{inr(o.total)}</Text></View>
      </View>
      {data.invoice ? <View style={styles.card}><Text style={styles.cardTitle}>Invoice</Text><Text style={styles.sub}>{data.invoice.invoice_number} • {inr(data.invoice.grand_total)}</Text></View> : null}

      {(canCancel || canReturn) && <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Actions</Text>
        <View style={styles.actions}>
          {canCancel && <Pressable style={styles.dangerBtn} onPress={() => { setAction("cancel"); setReason("customer_request"); }}><Text style={styles.btnText}>Request Cancellation</Text></Pressable>}
          {canReturn && <Pressable style={styles.outlineBtn} onPress={() => { setAction("return"); setReason("damaged"); }}><Text style={styles.outlineText}>Request Return</Text></Pressable>}
        </View>
      </View>}

      {action && <View style={styles.card}>
        <Text style={styles.cardTitle}>{action === "cancel" ? "Cancellation Request" : "Return Request"}</Text>
        {action === "return" ? <View style={styles.reasonRow}>{RETURN_REASONS.map(r => <Pressable key={r} onPress={() => setReason(r)} style={[styles.reason, reason === r && styles.reasonActive]}><Text style={reason === r ? styles.reasonActiveText : styles.reasonText}>{r.replaceAll("_", " ")}</Text></Pressable>)}</View> : null}
        <TextInput value={note} onChangeText={setNote} placeholder="Optional note" multiline style={styles.input} />
        <View style={styles.actions}>
          <Pressable style={styles.outlineBtn} onPress={() => setAction(null)} disabled={saving}><Text style={styles.outlineText}>Back</Text></Pressable>
          <Pressable style={styles.primaryBtn} onPress={submitAction} disabled={saving}><Text style={styles.btnText}>{saving ? "Submitting…" : "Submit Request"}</Text></Pressable>
        </View>
      </View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 16, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: "900", color: theme.colors.text, paddingTop: 24, paddingBottom: 14 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16, marginBottom: 12, gap: 9 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: theme.colors.text },
  status: { fontWeight: "900", textTransform: "capitalize" },
  sub: { fontSize: 13, color: theme.colors.textMuted },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12, marginTop: 8 },
  total: { fontSize: 18, fontWeight: "900" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "#b42318" },
  timeline: { gap: 0, paddingVertical: 6 },
  timelineItem: { minHeight: 52, flexDirection: "row", alignItems: "flex-start", position: "relative" },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", zIndex: 2 },
  dotDone: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dotActive: { borderWidth: 2 },
  dotText: { fontSize: 11, fontWeight: "900", color: theme.colors.textMuted },
  timelineText: { paddingLeft: 10, paddingTop: 2 },
  timelineLabel: { fontSize: 13, fontWeight: "700", color: theme.colors.textMuted },
  timelineDone: { color: theme.colors.text },
  line: { position: "absolute", left: 13, top: 28, width: 2, height: 24, backgroundColor: theme.colors.border },
  lineDone: { backgroundColor: theme.colors.primary },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  primaryBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 11 },
  dangerBtn: { backgroundColor: "#B42318", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 11 },
  outlineBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  outlineText: { color: theme.colors.text, fontWeight: "800", fontSize: 13 },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  reason: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  reasonActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  reasonText: { color: theme.colors.textMuted, fontSize: 12 },
  reasonActiveText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  input: { minHeight: 90, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, textAlignVertical: "top", color: theme.colors.text },
});
