import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { theme } from "@/src/theme";

type Props = {
  title: string;
  value: string | number;
  hint?: string;
  variant?: "light" | "dark";
  accent?: string; // optional color for value
  testID?: string;
  style?: ViewStyle;
};

export function KpiCard({ title, value, hint, variant = "light", accent, testID, style }: Props) {
  const isDark = variant === "dark";
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? theme.colors.surface : "#fff",
          borderColor: isDark ? theme.colors.borderDark : theme.colors.border,
        },
        style,
      ]}
    >
      <Text style={[styles.title, { color: isDark ? "#A1A1AA" : theme.colors.textMuted }]}>{title}</Text>
      <Text
        style={[
          styles.value,
          {
            color: accent || (isDark ? "#fff" : theme.colors.text),
          },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {hint ? <Text style={[styles.hint, { color: isDark ? "#71717A" : theme.colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 20,
    gap: 6,
    flex: 1,
    minWidth: 180,
    // @ts-ignore
    transitionProperty: "border-color",
    transitionDuration: "150ms",
  } as any,
  title: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    fontFamily: theme.fonts.mono,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
});
