import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type User = {
  id: string; name: string; mobile: string; role: string;
  kyc_status?: string | null; kyc_note?: string | null;
  aadhaar_number?: string | null; pan_number?: string | null;
  gst_number?: string | null; driving_license?: string | null;
  vehicle_number?: string | null; vehicle_type?: string | null;
  active: boolean;
};

export default function KYCPage() {
  const toast = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"seller" | "rider" | "all">("all");
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState({ kyc_status: "pending", kyc_note: "", aadhaar_number: "", pan_number: "", gst_number: "", driving_license: "", vehicle_number: "", vehicle_type: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = role !== "all" ? { role } : undefined;
      setRows((await api<{ items: User[] }>("/kyc/pending", { query: q })).items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [role, toast]);
  useEffect(() => { load(); }, [load]);

  const openReview = (u: User) => {
    setSelected(u);
    setForm({
      kyc_status: u.kyc_status || "pending",
      kyc_note: u.kyc_note || "",
      aadhaar_number: u.aadhaar_number || "",
      pan_number: u.pan_number || "",
      gst_number: u.gst_number || "",
      driving_license: u.driving_license || "",
      vehicle_number: u.vehicle_number || "",
      vehicle_type: u.vehicle_type || "",
    });
  };

  const submitDecision = async (decision: "approved" | "rejected") => {
    if (!selected) return;
    setSaving(true);
    try {
      const body = { ...form, kyc_status: decision };
      await api(`/users/${selected.id}/kyc`, { method: "PATCH", body });
      toast.success(`KYC ${decision}`);
      setSelected(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const saveDocuments = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const body = { ...form, kyc_status: form.kyc_status };
      await api(`/users/${selected.id}/kyc`, { method: "PATCH", body });
      toast.success("Documents saved");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const cols: Column<User>[] = useMemo(() => [
    { key: "name", label: "Name", flex: 1.5, render: (u) => (
      <View><Text style={styles.txt}>{u.name}</Text><Text style={styles.sub}>{u.mobile}</Text></View>
    )},
    { key: "role", label: "Role", flex: 0.8, render: (u) => <Badge variant="info">{u.role}</Badge> },
    { key: "kyc", label: "KYC", flex: 0.8, render: (u) => (
      <Badge variant={u.kyc_status === "approved" ? "success" : u.kyc_status === "rejected" ? "danger" : "warning"}>{u.kyc_status || "pending"}</Badge>
    )},
    { key: "status", label: "Account", flex: 0.7, render: (u) => <Badge variant={u.active ? "success" : "inactive"}>{u.active ? "Active" : "Off"}</Badge> },
    { key: "act", label: "", flex: 0.8, render: (u) => <Button title="Review" size="sm" variant="outline" onPress={() => openReview(u)} /> },
  ], []);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={styles.title}>KYC Verification</Text>
        <Text style={styles.subtitle}>Review and approve/reject Seller & Rider onboarding documents.</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        {(["all", "seller", "rider"] as const).map((r) => (
          <Button key={r} title={r === "all" ? "All" : r} size="sm" variant={role === r ? "primary" : "outline"} onPress={() => setRole(r)} />
        ))}
      </View>

      <DataTable columns={cols} rows={rows} loading={loading} empty="No pending KYC reviews" />

      <ModalCard visible={!!selected} onClose={() => setSelected(null)} title={selected ? `KYC Review: ${selected.name}` : ""} width={640}>
        {selected ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Badge variant="info">{selected.role}</Badge>
              <Badge variant={selected.kyc_status === "approved" ? "success" : "warning"}>KYC: {selected.kyc_status || "pending"}</Badge>
              <Text style={styles.sub}>Mobile: {selected.mobile}</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="Aadhaar Number" value={form.aadhaar_number} onChangeText={(v) => setForm((f) => ({ ...f, aadhaar_number: v }))} /></View>
              <View style={{ flex: 1 }}><Input label="PAN Number" value={form.pan_number} onChangeText={(v) => setForm((f) => ({ ...f, pan_number: v }))} /></View>
            </View>

            {selected.role === "seller" ? (
              <Input label="GST Number (optional)" value={form.gst_number} onChangeText={(v) => setForm((f) => ({ ...f, gst_number: v }))} />
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Input label="Driving License" value={form.driving_license} onChangeText={(v) => setForm((f) => ({ ...f, driving_license: v }))} /></View>
                <View style={{ flex: 1 }}><Input label="Vehicle Number" value={form.vehicle_number} onChangeText={(v) => setForm((f) => ({ ...f, vehicle_number: v }))} /></View>
                <View style={{ flex: 1 }}><Input label="Vehicle Type" value={form.vehicle_type} onChangeText={(v) => setForm((f) => ({ ...f, vehicle_type: v }))} placeholder="Bike/Auto/Van" /></View>
              </View>
            )}

            <Input label="Admin Note" value={form.kyc_note} onChangeText={(v) => setForm((f) => ({ ...f, kyc_note: v }))} placeholder="Reason for approval/rejection" />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Button title="Close" variant="outline" onPress={() => setSelected(null)} />
              <Button title="Save Documents" variant="secondary" onPress={saveDocuments} loading={saving} />
              <Button title="Reject" variant="danger" onPress={() => submitDecision("rejected")} loading={saving} />
              <Button title="Approve" onPress={() => submitDecision("approved")} loading={saving} />
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
});
