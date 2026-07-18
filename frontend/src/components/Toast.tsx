import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/src/theme";

type Toast = { id: number; type: "success" | "error" | "info"; message: string };
type ToastCtx = { show: (type: Toast["type"], message: string) => void; success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };

const Ctx = createContext<ToastCtx | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((type: Toast["type"], message: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider
      value={{
        show,
        success: (m) => show("success", m),
        error: (m) => show("error", m),
        info: (m) => show("info", m),
      }}
    >
      {children}
      <View style={styles.container}>
        {toasts.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
            style={[
              styles.toast,
              t.type === "success" && { borderLeftColor: theme.colors.success },
              t.type === "error" && { borderLeftColor: theme.colors.danger },
              t.type === "info" && { borderLeftColor: theme.colors.info },
            ]}
          >
            <Text style={styles.text}>{t.message}</Text>
          </Pressable>
        ))}
      </View>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used within ToastProvider");
  return c;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute" as any,
    top: 76,
    right: 20,
    gap: 8,
    zIndex: 9999,
    pointerEvents: "box-none",
  } as any,
  toast: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    borderLeftWidth: 4,
    minWidth: 280,
    maxWidth: 420,
    // @ts-ignore
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    cursor: "pointer",
  } as any,
  text: {
    color: "#fff",
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: "500",
  },
});
