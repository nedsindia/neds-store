import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
  testID?: string;
};

export function ModalCard({ visible, onClose, title, children, width = 520, testID }: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { width }]}
          onPress={(e) => e.stopPropagation?.()}
          testID={testID}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} testID="modal-close-button" style={styles.closeBtn}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(9,9,11,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: theme.radius.lg,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: theme.colors.border,
    // @ts-ignore
    boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
  } as any,
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 6,
    borderRadius: theme.radius.sm,
  },
  body: {
    padding: 20,
    gap: 12,
  },
});
