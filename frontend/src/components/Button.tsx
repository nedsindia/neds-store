import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "@/src/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type Props = {
  onPress?: () => void;
  title: string;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
  size?: "sm" | "md";
  leftIcon?: React.ReactNode;
};

export function Button({ onPress, title, variant = "primary", disabled, loading, fullWidth, style, testID, size = "md", leftIcon }: Props) {
  const isDisabled = disabled || loading;
  const bg = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    outline: "transparent",
    ghost: "transparent",
    danger: theme.colors.danger,
  }[variant];
  const color = {
    primary: theme.colors.primaryForeground,
    secondary: theme.colors.surfaceForeground,
    outline: theme.colors.text,
    ghost: theme.colors.text,
    danger: "#fff",
  }[variant];
  const border =
    variant === "outline" ? theme.colors.border : "transparent";

  return (
    <Pressable
      testID={testID}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ hovered, pressed }) => [
        styles.base,
        {
          backgroundColor:
            hovered && variant === "primary" ? theme.colors.primaryHover :
            hovered && variant === "secondary" ? theme.colors.surfaceMuted :
            hovered && variant === "ghost" ? theme.colors.bgSecondary :
            hovered && variant === "outline" ? theme.colors.bgSecondary :
            bg,
          borderColor: hovered && variant === "outline" ? theme.colors.surface : border,
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
          paddingVertical: size === "sm" ? 6 : 10,
          paddingHorizontal: size === "sm" ? 12 : 18,
          width: fullWidth ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.text, { color, fontSize: size === "sm" ? 13 : 14 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    // @ts-ignore rn-web
    transitionProperty: "background-color, border-color, opacity",
    transitionDuration: "150ms",
    cursor: "pointer",
  } as any,
  text: {
    fontFamily: theme.fonts.body,
    fontWeight: "600",
  },
});
