import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Column, DataTable } from "@/src/components/DataTable";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { Select } from "@/src/components/Select";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { formatDate, theme } from "@/src/theme";

type User = {
  id: string;
  name: string;
  mobile: string;
  role: string;
  email?: string | null;
  active: boolean;
  created_at: string;
};

const ROLE_OPTIONS = [
  { label: "All roles", value: "" },
  { label: "Super Admin", value: "super_admin" },
  { label: "Manager", value: "manager" },
  { label: "Staff Admin", value: "staff_admin" },
  { label: "Customer", value: "customer" },
  { label: "Seller", value: "seller" },
  { label: "Rider", value: "rider" },
  { label: "Staff", value: "staff" },
];

const CREATE_ROLE_OPTIONS = ROLE_OPTIONS.slice(1);

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", password: "", role: "customer", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: User[]; total: number }>("/users", { query: { q, role } });
      setRows(res.items);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, role]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ name: "", mobile: "", password: "", role: "customer", email: "" });
    setErrors({});
    setModal(true);
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!/^\d{10}$/.test(form.mobile)) e.mobile = "10-digit mobile required";
    if (form.password.length < 6) e.password = "Min 6 chars";
    if (!form.role) e.role = "Role required";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      await api("/users", { method: "POST", body: form });
      toast.success("User created");
      setModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      if (u.active) {
        await api(`/users/${u.id}`, { method: "DELETE" });
        toast.success(`${u.name} deactivated`);
      } else {
        await api(`/users/${u.id}`, { method: "PATCH", body: { active: true } });
        toast.success(`${u.name} reactivated`);
      }
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const columns: Column<User>[] = [
    { key: "name", label: "Name", flex: 1.4, render: (u) => (
      <View>
        <Text style={{ fontFamily: theme.fonts.body, fontWeight: "600", color: theme.colors.text, fontSize: 13 }}>{u.name}</Text>
        {u.email ? <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textMuted, fontSize: 12 }}>{u.email}</Text> : null}
      </View>
    )},
    { key: "mobile", label: "Mobile", flex: 1, render: (u) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 13, color: theme.colors.text }}>+91 {u.mobile}</Text>
    )},
    { key: "role", label: "Role", flex: 1, render: (u) => <Badge variant={u.active ? "info" : "inactive"}>{u.role}</Badge> },
    { key: "active", label: "Status", flex: 0.8, render: (u) => <Badge variant={u.active ? "active" : "inactive"}>{u.active ? "Active" : "Disabled"}</Badge> },
    { key: "created_at", label: "Created", flex: 1.1, render: (u) => (
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.textMuted }}>{formatDate(u.created_at)}</Text>
    )},
    { key: "actions", label: "Actions", flex: 0.8, align: "right", render: (u) => (
      <Button
        size="sm"
        variant={u.active ? "outline" : "primary"}
        title={u.active ? "Disable" : "Enable"}
        onPress={() => toggleActive(u)}
        testID={`user-toggle-${u.id}`}
      />
    )},
  ];

  return (
    <View style={{ gap: 16 }} testID="users-screen">
      <View style={styles.toolbar}>
        <Input
          testID="users-search"
          placeholder="Search by name or mobile"
          value={q}
          onChangeText={setQ}
          containerStyle={{ flex: 1, maxWidth: 320 }}
        />
        <Select testID="users-role-filter" value={role} onChange={setRole} options={ROLE_OPTIONS} width={200} />
        <View style={{ flex: 1 }} />
        <Button title="+ Add User" onPress={openCreate} testID="users-add-button" />
      </View>

      <DataTable columns={columns} rows={rows} loading={loading} empty="No users match your filters." testID="users-table" />

      <ModalCard visible={modal} onClose={() => setModal(false)} title="Create New User">
        <Input label="Full Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={errors.name} testID="new-user-name" />
        <Input label="Mobile Number" value={form.mobile} onChangeText={(v) => setForm({ ...form, mobile: v.replace(/\D/g, "").slice(0, 10) })} keyboardType="number-pad" error={errors.mobile} testID="new-user-mobile" />
        <Input label="Email (optional)" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry error={errors.password} testID="new-user-password" />
        <Select label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={CREATE_ROLE_OPTIONS} testID="new-user-role" />
        <View style={styles.modalFooter}>
          <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
          <Button title={saving ? "Creating…" : "Create User"} onPress={submit} loading={saving} testID="new-user-submit" />
        </View>
        <Text style={styles.hint}>
          <Feather name="info" size={11} color={theme.colors.textMuted} />  {me?.role === "super_admin" ? "You can assign any role including admin roles." : "Only Super Admin can assign admin-level roles."}
        </Text>
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
  },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  hint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
});
