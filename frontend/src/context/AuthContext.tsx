import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";
import { api, AUTH_USER_KEY, clearToken, getToken, setToken } from "@/src/api/client";

export type Role = "super_admin" | "manager" | "staff_admin" | "customer" | "seller" | "rider" | "staff";

export type AuthUser = {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  email?: string | null;
  active: boolean;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (mobile: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const ADMIN_ROLES: Role[] = ["super_admin", "manager", "staff_admin"];
export const isAdminRole = (r: Role | undefined | null) => !!r && ADMIN_ROLES.includes(r);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<AuthUser>("/auth/me");
      setUser(me);
      await storage.setItem(AUTH_USER_KEY, me as any);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const login = useCallback(async (mobile: string, password: string) => {
    const res = await api<{ access_token: string; user: AuthUser }>(
      "/auth/login",
      { method: "POST", body: { mobile, password }, skipAuth: true },
    );
    await setToken(res.access_token);
    await storage.setItem(AUTH_USER_KEY, res.user as any);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refresh: load }), [user, loading, login, logout, load]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
