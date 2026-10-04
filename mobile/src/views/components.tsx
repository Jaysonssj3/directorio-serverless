import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
export const colors = { ink: '#182C37', muted: '#617580', bg: '#F3F6F5', paper: '#FFFFFF', green: '#166B55', line: '#DDE6E2', red: '#A42D3F' };
export function Button({ title, onPress, disabled, secondary, danger }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.green }, danger && { color: colors.red }]}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} /></View>;
}
export function Feedback({ error, notice }: { error?: string; notice?: string }) {
  return <>{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}</>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 22, gap: 18, paddingBottom: 40, width: '100%', maxWidth: 650, alignSelf: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: colors.green },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  card: { padding: 20, borderRadius: 22, backgroundColor: colors.paper, gap: 14, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFCFB', borderRadius: 12, minHeight: 49, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  button: { minHeight: 46, backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 17, paddingVertical: 13, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 14 },
  secondary: { backgroundColor: '#E8F1ED' },
  danger: { backgroundColor: '#FBECEF' },
  error: { color: colors.red, backgroundColor: '#FBECEF', padding: 14, borderRadius: 12, lineHeight: 21 },
  notice: { color: colors.green, backgroundColor: '#E8F1ED', padding: 14, borderRadius: 12, lineHeight: 21 },
  tag: { color: colors.green, backgroundColor: '#E8F1ED', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
});
