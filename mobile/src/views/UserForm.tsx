import React, { useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UsuariosViewModel } from '../viewmodels/UsuariosViewModel';
import type { Role, Usuario } from '../models/Usuario';
import { Button, Feedback, Field, styles } from './components';
export function UserForm({ vm, user, close }: { vm: UsuariosViewModel; user: Usuario | null; close: () => void }) {
  const state = useSyncExternalStore(vm.subscribe, vm.getSnapshot);
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('USER');
  return <Modal animationType="slide" onRequestClose={() => { if (!state.saving) close(); }}>
    <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>GESTIÓN DE USUARIOS</Text><Text style={styles.title}>{user ? 'Editar perfil' : 'Nueva persona'}</Text>
        <Text style={styles.muted}>{user ? 'El correo y el nombre se actualizarán en PostgreSQL.' : 'Crea una cuenta y define sus permisos.'}</Text>
        <View style={styles.card}>
          <Field label="Nombre" value={nombre} onChangeText={setNombre} maxLength={100} editable={!state.saving} />
          <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!state.saving} />
          {!user && <><Field label="Contraseña · mínimo 12 caracteres" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" editable={!state.saving} />
            <Text style={styles.label}>Permisos</Text><View style={styles.row}>{(['USER', 'ADMIN'] as const).map(r => <Button key={r} title={(r === role ? '✓ ' : '') + r} secondary={r !== role} disabled={state.saving} onPress={() => setRole(r)} />)}</View></>}
          {user && <Text style={styles.muted}>Rol: {user.role} · El endpoint de edición conserva la contraseña y el rol.</Text>}
          <Feedback error={state.error} />
          <Button title={state.saving ? 'Guardando…' : 'Guardar usuario'} disabled={state.saving} onPress={() => { void vm.save({ nombre, email, password, role }, user?.id).then(ok => { if (ok) close(); }); }} />
          <Button title="Cancelar" secondary disabled={state.saving} onPress={close} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}
