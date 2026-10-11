import React, { useSyncExternalStore } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NotificationsViewModel } from '../viewmodels/NotificationsViewModel';
import { Button, Field, Feedback, styles } from './components';
export function NotificationsScreen({ vm, close }: { vm: NotificationsViewModel; close: () => void }) {
  const state = useSyncExternalStore(vm.subscribe, vm.getSnapshot);
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Enviar correo</Text>
    <Text style={styles.muted}>El envío se procesa en segundo plano. La confirmación indica que aceptamos la solicitud; la entrega puede tardar.</Text>
    <View style={styles.card}>
      <Field label="Correo destino" value={state.email} onChangeText={v => vm.change('email', v)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!state.sending} />
      <Field label="Asunto" value={state.subject} onChangeText={v => vm.change('subject', v)} maxLength={150} editable={!state.sending} />
      <Field label="Mensaje" value={state.message} onChangeText={v => vm.change('message', v)} multiline maxLength={5000} style={{ minHeight: 150, textAlignVertical: 'top' }} editable={!state.sending} />
      <Feedback error={state.error} notice={state.notice} />
      {!!state.notificationId && <Text selectable style={styles.muted}>Referencia: {state.notificationId}</Text>}
      <Button title={state.sending ? 'Enviando…' : 'Enviar correo'} disabled={state.sending} onPress={() => { void vm.send(); }} />
      <Button title="Volver" secondary disabled={state.sending} onPress={close} />
    </View>
  </ScrollView>;
}
