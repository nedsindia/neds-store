import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "@/src/theme";

export type Column<T> = {
  key: string;
  label: string;
  width?: number | string;
  flex?: number;
  render?: (row: T) => React.ReactNode;
  mono?: boolean;
  align?: "left" | "right" | "center";
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  keyExtractor?: (row: T, idx: number) => string;
  empty?: string;
  loading?: boolean;
  testID?: string;
};

export function DataTable<T extends { id?: string }>({ columns, rows, keyExtractor, empty = "No records found", loading, testID }: Props<T>) {
  return (
    <View style={styles.wrap} testID={testID}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            {columns.map((c) => (
              <View
                key={c.key}
                style={[
                  styles.cell,
                  { flex: c.flex ?? 1, width: c.width as any, justifyContent: c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start" },
                ]}
              >
                <Text style={styles.headerText}>{c.label}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Loading…</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{empty}</Text>
            </View>
          ) : (
            rows.map((row, idx) => (
              <View
                key={keyExtractor ? keyExtractor(row, idx) : (row as any).id || idx}
                style={[styles.row, idx === rows.length - 1 && { borderBottomWidth: 0 }]}
              >
                {columns.map((c) => {
                  const content = c.render ? c.render(row) : (row as any)[c.key];
                  return (
                    <View
                      key={c.key}
                      style={[
                        styles.cell,
                        { flex: c.flex ?? 1, width: c.width as any, justifyContent: c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start" },
                      ]}
                    >
                      {typeof content === "string" || typeof content === "number" ? (
                        <Text style={[styles.cellText, c.mono && { fontFamily: theme.fonts.mono }]} numberOfLines={1}>
                          {content}
                        </Text>
                      ) : (
                        content
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: "#fff",
  },
  cell: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 100,
  },
  cellText: {
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
  },
  emptyBox: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
