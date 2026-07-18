import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/src/theme";

type Option = { label: string; value: string };
type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  testID?: string;
  disabled?: boolean;
  width?: number | string;
};

export function Select({ label, value, onChange, options, placeholder = "Select…", testID, disabled, width }: Props) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);

  // Web: use native <select> for maximum reliability
  if (Platform.OS === "web") {
    return (
      <View style={{ gap: 6, width: width as any }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {/* @ts-ignore */}
        <select
          data-testid={testID}
          value={value}
          disabled={disabled}
          onChange={(e: any) => onChange(e.target.value)}
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: "10px 12px",
            fontFamily: theme.fonts.body,
            fontSize: 14,
            backgroundColor: "#fff",
            outline: "none",
            color: theme.colors.text,
            width: "100%",
          }}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </View>
    );
  }

  return (
    <View style={{ gap: 6, width: width as any }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        testID={testID}
        onPress={() => !disabled && setOpen((v) => !v)}
        style={[styles.trigger, disabled && { opacity: 0.5 }]}
      >
        <Text style={[styles.text, !current && { color: theme.colors.textSubtle }]}>{current?.label || placeholder}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          {options.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => { onChange(o.value); setOpen(false); }}
              style={({ hovered }) => [styles.option, hovered && { backgroundColor: theme.colors.bgSecondary }]}
            >
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
  },
  trigger: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  text: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text },
  dropdown: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: "#fff",
    marginTop: 4,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text },
});
