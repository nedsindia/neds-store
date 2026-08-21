import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Staff = {
  id: string;
  name: string;
  mobile: string;
  role: string;
  email?: string;
  designation?: string;
  department?: string;
  monthly_salary?: number;
  active: boolean;
  created_at: string;
};

const ROLES = ["staff", "staff_admin", "manager"];
const fmtINR = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function StaffPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ name: "", mobile: "", password: "", email: "", role: "staff", designation: "", department: "", monthly_salary: "0" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await api<{ items: Staff[] }>("/staff")).items); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", mobile: "", password: "", email: "", role: "staff", designation: "", department: "", monthly_salary: "0" });
    setModal(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      name: s.name, mobile: s.mobile, password: "", email: s.email || "",
      role: s.role, designation: s.designation || "", department: s.department || "",
      monthly_salary: String(s.monthly_salary || 0),
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const body: any = {
        name: form.name, email: form.email || null, role: form.role,
        designation: form.designation, department: form.department,
        monthly_salary: parseFloat(form.monthly_salary) || 0,
      };
      if (editing) {
        if (form.password) body.password = form.password;
        await api(`/staff/${editing.id}`, { method: "PATCH", body });
        toast.success("Staff updated");
      } else {
        if (!form.mobile.match(/^\d{10}$/)) throw new Error("Mobile must be 10 digits");
        if (!form.password) throw new Error("Password required");
        body.mobile = form.mobile; body.password = form.password;
        await api("/staff", { method: "POST", body });
        toast.success("Staff created");
      }
      setModal(false); await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s: Staff) => {
    try {
      await api(`/staff/${s.id}`, { method: "PATCH", body: { active: !s.active } });
      toast.success(!s.active ? "Activated" : "Deactivated"); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const paySalary = async (s: Staff) => {
    if (!window.confirm(`Pay ${fmtINR(s.monthly_salary)} salary to ${s.name} for this month?`)) return;
    try {
      await api(`/staff/${s.id}/salary/pay`, { method: "POST" });
      toast.success("Salary recorded"); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const cols: Column<Staff>[] = useMemo(() => [
    { key: "name", label: "Name", flex: 1.5, render: (s) => (
      <View><Text style={styles.txt}>{s.name}</Text><Text style={styles.sub}>{s.designation || s.role}</Text></View>
    )},
    { key: "mobile", label: "Mobile", flex: 1, render: (s) => <Text style={styles.mono}>{s.mobile}</Text> },
    { key: "role", label: "Role", flex: 1, render: (s) => <Badge variant="info">{s.role}</Badge> },
    { key: "dept", label: "Department", flex: 1, render: (s) => <Text style={styles.txt}>{s.department || "—"}</Text> },
    { key: "salary", label: "Salary", flex: 0.8, align: "right", render: (s) => <Text style={styles.txt}>{fmtINR(s.monthly_salary)}</Text> },
    { key: "status", label: "Status", flex: 0.7, render: (s) => <Badge variant={s.active ? "success" : "inactive"}>{s.active ? "Active" : "Inactive"}</Badge> },
    { key: "act", label: "", flex: 1.6, render: (s) => (
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button title="Edit" size="sm" variant="outline" onPress={() => openEdit(s)} />
        <Button title="Pay Salary" size="sm" onPress={() => paySalary(s)} />
        <Button title={s.active ? "Disable" : "Enable"} size="sm" variant={s.active ? "danger" : "secondary"} onPress={() => toggleActive(s)} />
      </View>
    )},
  ], []);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={styles.title}>Staff Management</Text>
          <Text style={styles.subtitle}>Manage staff members, their roles and monthly salaries. RBAC permissions apply per role.</Text>
        </View>
        <Button title="Add Staff" onPress={openCreate} leftIcon={<Feather name="user-plus" size={14} color="#fff" />} />
      </View>

      <DataTable columns={cols} rows={rows} loading={loading} empty="No staff members yet — click Add Staff" />

      <ModalCard visible={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : "Add Staff Member"} width={640}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} /></View>
            <View style={{ flex: 1 }}><Input label="Mobile" value={form.mobile} onChangeText={(v) => setForm((f) => ({ ...f, mobile: v }))} keyboardType="numeric" editable={!editing} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} /></View>
            <View style={{ flex: 1 }}><Input label={editing ? "New Password (optional)" : "Password"} value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} secureTextEntry /></View>
          </View>

          <Text style={styles.label}>Role</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {ROLES.map((r) => (
              <Button key={r} title={r.replace(/_/g, " ")} size="sm"
                variant={form.role === r ? "primary" : "outline"}
                onPress={() => setForm((f) => ({ ...f, role: r }))} />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Designation" value={form.designation} onChangeText={(v) => setForm((f) => ({ ...f, designation: v }))} /></View>
            <View style={{ flex: 1 }}><Input label="Department" value={form.department} onChangeText={(v) => setForm((f) => ({ ...f, department: v }))} /></View>
            <View style={{ flex: 1 }}><Input label="Monthly Salary ₹" value={form.monthly_salary} onChangeText={(v) => setForm((f) => ({ ...f, monthly_salary: v }))} keyboardType="numeric" /></View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
            <Button title={editing ? "Save" : "Create"} onPress={save} loading={saving} />
          </View>
        </View>
      </ModalCard>
    </View>
  );
}

declare const window: any;

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  txt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  mono: { fontFamily: "monospace", fontSize: 12, color: theme.colors.text },
  label: { fontFamily: theme.fonts.body, fontSize: 11, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
});
