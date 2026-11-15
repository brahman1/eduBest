import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type KeyboardTypeOptions,
} from "react-native";
import { theme } from "./theme";
export const ui = StyleSheet.create({
  panel: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.ink },
  text: { fontSize: 14, lineHeight: 22, color: theme.muted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  error: {
    color: theme.danger,
    backgroundColor: theme.dangerBg,
    padding: 14,
    borderRadius: 10,
    lineHeight: 22,
  },
  success: {
    color: theme.success,
    backgroundColor: theme.successBg,
    padding: 14,
    borderRadius: 10,
    lineHeight: 22,
  },
});
export function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={ui.panel}>
      {title && (
        <Text accessibilityRole="header" style={ui.title}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  selected = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 46,
        justifyContent: "center",
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: danger
          ? theme.danger
          : selected
            ? theme.action
            : theme.line,
        backgroundColor: danger
          ? theme.dangerBg
          : selected
            ? theme.softBlue
            : theme.surface,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: danger ? theme.danger : theme.action,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Input({
  label,
  value,
  onChange,
  secure = false,
  numeric = false,
  multiline = false,
  disabled = false,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  numeric?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: theme.ink, fontWeight: "600" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType ?? (numeric ? "numeric" : "default")}
        maxLength={maxLength}
        multiline={multiline}
        style={{
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 10,
          padding: 12,
          minHeight: 48,
          color: theme.ink,
          backgroundColor: theme.paper,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
