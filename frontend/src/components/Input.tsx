import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { theme } from "@/src/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  containerStyle?: any;
  testID?: string;
};

export function Input({ label, error, hint, containerStyle, style, testID, ...rest }: Props) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={theme.colors.textSubtle}
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: "#fff",
    // @ts-ignore
    outlineStyle: "none",
    transitionProperty: "border-color, box-shadow",
    transitionDuration: "150ms",
  } as any,
  inputFocused: {
    borderColor: theme.colors.primary,
    // @ts-ignore
    boxShadow: `0 0 0 3px ${theme.colors.primary}22`,
  } as any,
  inputError: { borderColor: theme.colors.danger },
  error: { fontSize: 12, color: theme.colors.danger, fontFamily: theme.fonts.body },
  hint: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.body },
});
