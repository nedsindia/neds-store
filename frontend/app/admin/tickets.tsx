import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Msg = { id: string; message: string; internal: boolean; sender_name?: string; sender_role?: string; created_at: string };
type Ticket = {
  id: string; subject: string; category: string; priority: string; status: string;
  customer_name?: string; customer_role?: string; order_id?: string | null;
  description: string; messages: Msg[]; created_at: string; updated_at: string;
};

const STATUS_TABS = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;
const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function TicketsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState({ message: "", internal: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? { status: statusFilter } : undefined;
      setRows((await api<{ items: Ticket[] }>("/tickets", { query: q })).items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [statusFilter, toast]);
  useEffect(() => { load(); }, [load]);

  const sendReply = async () => {
    if (!selected || !reply.message.trim()) return;
    setSaving(true);
    try {
      await api(`/tickets/${selected.id}/reply`, { method: "POST", body: { message: reply.message, internal: reply.internal } });
      const updated = (await api<{ items: Ticket[] }>("/tickets")).items.find((t) => t.id === selected.id);
      setSelected(updated || null);
      setReply({ message: "", internal: false });
      toast.success("Reply sent");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const setStatus = async (s: string) => {
    if (!selected) return;
    try {
      const updated = await api<Ticket>(`/tickets/${selected.id}/status`, { method: "PATCH", body: { status: s } });
      setSelected(updated);
      toast.success(`Status → ${s}`);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const cols: Column<Ticket>[] = useMemo(() => [
    { key: "id", label: "ID", flex: 0.8, render: (t) => <Text style={styles.mono}>{t.id.substring(0, 8)}</Text> },
    { key: "subject", label: "Subject", flex: 2, render: (t) => (
      <View>
        <Text style={styles.txt}>{t.subject}</Text>
        <Text style={styles.sub}>{t.category} · from {t.customer_name || t.customer_role}</Text>
      </View>
    )},
    { key: "priority", label: "Priority", flex: 0.8, render: (t) => (
      <Badge variant={t.priority === "critical" ? "danger" : t.priority === "high" ? "warning" : "info"}>{t.priority}</Badge>
    )},
    { key: "status", label: "Status", flex: 1, render: (t) => (
      <Badge variant={t.status === "resolved" || t.status === "closed" ? "success" : t.status === "open" ? "warning" : "info"}>{t.status.replace(/_/g, " ")}</Badge>
    )},
    { key: "when", label: "Updated", flex: 1, render: (t) => <Text style={styles.txt}>{fmtDate(t.updated_at)}</Text> },
    { key: "act", label: "", flex: 0.6, render: (t) => <Button title="Open" size="sm" variant="outline" onPress={() => setSelected(t)} /> },
  ], []);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={styles.title}>Support Tickets</Text>
        <Text style={styles.subtitle}>Manage customer, seller & rider support requests. Reply, add internal notes, update status.</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button title="All" size="sm" variant={statusFilter === null ? "primary" : "outline"} onPress={() => setStatusFilter(null)} />
        {STATUS_TABS.map((s) => (
          <Button key={s} title={s.replace(/_/g, " ")} size="sm"
            variant={statusFilter === s ? "primary" : "outline"}
            onPress={() => setStatusFilter(s)} />
        ))}
      </View>

      <DataTable columns={cols} rows={rows} loading={loading} empty="No tickets" />

      <ModalCard visible={!!selected} onClose={() => setSelected(null)} title={selected ? `Ticket · ${selected.subject}` : ""} width={720}>
        {selected ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Badge variant={selected.priority === "critical" ? "danger" : "info"}>{selected.priority}</Badge>
              <Badge variant="info">{selected.category}</Badge>
              <Badge variant={selected.status === "resolved" ? "success" : "warning"}>{selected.status}</Badge>
              {selected.order_id ? <Badge variant="inactive">Order: {selected.order_id.substring(0, 8)}</Badge> : null}
            </View>
            <Text style={styles.sub}>From: {selected.customer_name} ({selected.customer_role}) · Opened {fmtDate(selected.created_at)}</Text>

            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
              {selected.messages.map((m) => (
                <View key={m.id} style={[styles.msg, m.internal && styles.msgInternal]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.msgSender}>{m.sender_name || m.sender_role} {m.internal ? "· (internal)" : ""}</Text>
                    <Text style={styles.msgTime}>{fmtDate(m.created_at)}</Text>
                  </View>
                  <Text style={styles.msgBody}>{m.message}</Text>
                </View>
              ))}
            </ScrollView>

            <Input label="Reply" value={reply.message} onChangeText={(v) => setReply((r) => ({ ...r, message: v }))} placeholder="Type your reply..." multiline numberOfLines={3} />
            <Pressable onPress={() => setReply((r) => ({ ...r, internal: !r.internal }))} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <View style={[styles.checkbox, reply.internal && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                {reply.internal ? <Text style={{ color: "#fff", fontSize: 10 }}>✓</Text> : null}
              </View>
              <Text style={styles.txt}>Internal note (not visible to customer)</Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {["in_progress", "waiting_customer", "resolved", "closed"].map((s) => (
                <Button key={s} title={s.replace(/_/g, " ")} size="sm" variant="outline" onPress={() => setStatus(s)} />
              ))}
              <View style={{ flex: 1 }} />
              <Button title="Send Reply" onPress={sendReply} loading={saving} />
            </View>
          </View>
        ) : null}
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  txt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  mono: { fontFamily: "monospace", fontSize: 12, color: theme.colors.text },
  msg: { backgroundColor: "#fff", padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  msgInternal: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
  msgSender: { fontFamily: theme.fonts.body, fontSize: 11, fontWeight: "700", color: theme.colors.text },
  msgTime: { fontFamily: theme.fonts.body, fontSize: 10, color: theme.colors.textMuted },
  msgBody: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, marginTop: 4 },
  checkbox: { width: 16, height: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 3, alignItems: "center", justifyContent: "center" },
});
