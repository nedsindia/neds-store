import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Badge } from "@/src/components/Badge";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { ModalCard } from "@/src/components/ModalCard";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { theme } from "@/src/theme";

type Permission = { key: string; label: string };
type Catalog = Record<string, Permission[]>;

type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  system?: boolean;
};

type FormState = { id: string; name: string; description: string; permissions: Set<string> };

export default function RBACPage() {
  const toast = useToast();
  const [catalog, setCatalog] = useState<Catalog>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ id: "", name: "", description: "", permissions: new Set() });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [permRes, rolesRes] = await Promise.all([
        api<{ catalog: Catalog }>("/rbac/permissions"),
        api<{ items: Role[] }>("/rbac/roles"),
      ]);
      setCatalog(permRes.catalog);
      setRoles(rolesRes.items);
      setSelectedRoleId((cur) => cur || (rolesRes.items[0]?.id ?? null));
    } catch (e: any) {
      toast.error(e.message || "Failed to load RBAC data");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const allPermKeys = useMemo(() => {
    const keys: string[] = [];
    Object.values(catalog).forEach((items) => items.forEach((p) => keys.push(p.key)));
    return keys;
  }, [catalog]);

  const openCreate = () => {
    setEditingRoleId(null);
    setForm({ id: "", name: "", description: "", permissions: new Set() });
    setModal(true);
  };

  const openEdit = (role: Role) => {
    setEditingRoleId(role.id);
    setForm({
      id: role.id,
      name: role.name,
      description: role.description || "",
      permissions: new Set(role.permissions.includes("*") ? allPermKeys : role.permissions),
    });
    setModal(true);
  };

  const togglePerm = (key: string) => {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...f, permissions: next };
    });
  };

  const toggleGroup = (group: string, on: boolean) => {
    setForm((f) => {
      const next = new Set(f.permissions);
      (catalog[group] || []).forEach((p) => {
        if (on) next.add(p.key); else next.delete(p.key);
      });
      return { ...f, permissions: next };
    });
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Role name required"); return; }
    if (!editingRoleId && !form.id.trim()) { toast.error("Role ID required (slug)"); return; }
    setSaving(true);
    try {
      const permsArr = Array.from(form.permissions);
      if (editingRoleId) {
        await api(`/rbac/roles/${editingRoleId}`, {
          method: "PATCH",
          body: { name: form.name, description: form.description, permissions: permsArr },
        });
        toast.success("Role updated");
      } else {
        await api("/rbac/roles", {
          method: "POST",
          body: { id: form.id.trim(), name: form.name, description: form.description, permissions: permsArr },
        });
        toast.success("Role created");
      }
      setModal(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: Role) => {
    // eslint-disable-next-line no-alert
    if (typeof window !== "undefined" && !window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await api(`/rbac/roles/${role.id}`, { method: "DELETE" });
      toast.success("Role deleted");
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete role");
    }
  };

  const isWildcard = selectedRole?.permissions.includes("*");
  const selectedPerms = new Set(isWildcard ? allPermKeys : (selectedRole?.permissions || []));

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Roles & Permissions</Text>
          <Text style={styles.subtitle}>
            Fine-grained access control for staff and admin users. System roles cannot be deleted.
          </Text>
        </View>
        <Button title="Create Custom Role" onPress={openCreate} testID="rbac-create-role" leftIcon={<Feather name="plus" size={14} color="#fff" />} />
      </View>

      <View style={styles.body}>
        {/* Roles list */}
        <View style={styles.rolesCol}>
          <Text style={styles.colHead}>Roles ({roles.length})</Text>
          <View style={{ gap: 6 }}>
            {roles.map((r) => {
              const active = r.id === selectedRoleId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedRoleId(r.id)}
                  style={({ hovered }) => [
                    styles.roleItem,
                    active && styles.roleItemActive,
                    hovered && !active && { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                  testID={`role-${r.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleName, active && { color: "#fff" }]}>{r.name}</Text>
                    <Text style={[styles.roleId, active && { color: "#D1D5DB" }]}>{r.id}</Text>
                  </View>
                  <Badge variant={r.system ? "info" : "success"}>{r.system ? "System" : "Custom"}</Badge>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Permission matrix */}
        <View style={styles.matrixCol}>
          {selectedRole ? (
            <>
              <View style={styles.matrixHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matrixTitle}>{selectedRole.name}</Text>
                  <Text style={styles.matrixDesc}>{selectedRole.description || "—"}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <Badge variant="inactive">{`${selectedPerms.size} of ${allPermKeys.length} permissions`}</Badge>
                    {isWildcard ? <Badge variant="warning">Wildcard *</Badge> : null}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {selectedRole.id !== "super_admin" ? (
                    <Button title="Edit" variant="outline" onPress={() => openEdit(selectedRole)} leftIcon={<Feather name="edit-2" size={14} color={theme.colors.text} />} />
                  ) : null}
                  {!selectedRole.system ? (
                    <Button title="Delete" variant="danger" onPress={() => deleteRole(selectedRole)} leftIcon={<Feather name="trash-2" size={14} color="#fff" />} />
                  ) : null}
                </View>
              </View>
              <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
                {Object.entries(catalog).map(([group, items]) => {
                  const groupHave = items.filter((p) => selectedPerms.has(p.key)).length;
                  return (
                    <View key={group} style={styles.groupCard}>
                      <View style={styles.groupHead}>
                        <Text style={styles.groupName}>{group}</Text>
                        <Badge variant={groupHave === items.length ? "success" : groupHave > 0 ? "info" : "inactive"}>{`${groupHave}/${items.length}`}</Badge>
                      </View>
                      <View style={styles.permsGrid}>
                        {items.map((p) => (
                          <View key={p.key} style={styles.permChip}>
                            <Feather
                              name={selectedPerms.has(p.key) ? "check-circle" : "circle"}
                              size={14}
                              color={selectedPerms.has(p.key) ? theme.colors.primary : "#A1A1AA"}
                            />
                            <Text style={styles.permLabel}>{p.label}</Text>
                            <Text style={styles.permKey}>{p.key}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.emptyMsg}>Select a role to view its permission matrix.</Text>
          )}
        </View>
      </View>

      <ModalCard
        visible={modal}
        onClose={() => setModal(false)}
        title={editingRoleId ? `Edit Role: ${form.name}` : "Create Custom Role"}
        width={800}
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {!editingRoleId ? (
              <View style={{ flex: 1 }}>
                <Input
                  label="Role ID (slug)"
                  value={form.id}
                  onChangeText={(v) => setForm((f) => ({ ...f, id: v.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                  placeholder="e.g. warehouse_lead"
                />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Input
                label="Role Name"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />
            </View>
          </View>
          <Input
            label="Description"
            value={form.description}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="What can this role do?"
          />

          <Text style={[styles.matrixTitle, { marginTop: 8 }]}>Permissions</Text>
          <Text style={styles.matrixDesc}>
            Select the permissions this role should have. {form.permissions.size}/{allPermKeys.length} selected.
          </Text>

          <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 8 }}>
            {Object.entries(catalog).map(([group, items]) => {
              const groupHave = items.filter((p) => form.permissions.has(p.key)).length;
              const allOn = groupHave === items.length;
              return (
                <View key={group} style={styles.editGroupCard}>
                  <View style={styles.editGroupHead}>
                    <Text style={styles.groupName}>{group}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.editGroupCount}>{groupHave}/{items.length}</Text>
                      <Switch value={allOn} onValueChange={(v) => toggleGroup(group, v)} />
                    </View>
                  </View>
                  <View style={styles.editPermsGrid}>
                    {items.map((p) => (
                      <Pressable
                        key={p.key}
                        onPress={() => togglePerm(p.key)}
                        style={({ hovered }) => [
                          styles.editPermChip,
                          form.permissions.has(p.key) && styles.editPermChipOn,
                          hovered && { borderColor: theme.colors.primary },
                        ]}
                      >
                        <Feather
                          name={form.permissions.has(p.key) ? "check-square" : "square"}
                          size={14}
                          color={form.permissions.has(p.key) ? theme.colors.primary : "#A1A1AA"}
                        />
                        <Text style={styles.editPermLabel}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
            <Button
              title={editingRoleId ? "Save Changes" : "Create Role"}
              onPress={save}
              loading={saving}
              leftIcon={<Feather name="save" size={14} color="#fff" />}
            />
          </View>
        </View>
      </ModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  body: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  rolesCol: {
    width: 280,
    backgroundColor: "#fff",
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  colHead: { fontFamily: theme.fonts.heading, fontSize: 12, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase" },
  roleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: theme.radius.md,
    cursor: "pointer" as any,
  },
  roleItemActive: { backgroundColor: theme.colors.text },
  roleName: { fontFamily: theme.fonts.body, fontSize: 14, fontWeight: "600", color: theme.colors.text },
  roleId: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  matrixCol: { flex: 1, backgroundColor: "#fff", borderRadius: theme.radius.lg, padding: 20, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  matrixHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  matrixTitle: { fontFamily: theme.fonts.heading, fontSize: 18, fontWeight: "700", color: theme.colors.text },
  matrixDesc: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  groupCard: { padding: 12, borderRadius: theme.radius.md, backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: theme.colors.border },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  groupName: { fontFamily: theme.fonts.heading, fontSize: 13, fontWeight: "700", color: theme.colors.text },
  permsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  permLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text },
  permKey: { fontFamily: theme.fonts.body, fontSize: 10, color: theme.colors.textMuted, marginLeft: 2 },
  emptyMsg: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textMuted, textAlign: "center", padding: 40 },
  editGroupCard: { padding: 12, borderRadius: theme.radius.md, backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: theme.colors.border },
  editGroupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  editGroupCount: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted },
  editPermsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  editPermChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    cursor: "pointer" as any,
  },
  editPermChipOn: { borderColor: theme.colors.primary, backgroundColor: "rgba(5,150,105,0.08)" },
  editPermLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text },
});
