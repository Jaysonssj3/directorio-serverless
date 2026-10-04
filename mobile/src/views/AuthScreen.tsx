import React, { useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import type { SessionViewModel } from '../viewmodels/SessionViewModel';
import { Button, Feedback, Field, styles } from './components';
export function AuthScreen({ vm }: { vm: SessionViewModel }) {
  const state = useSyncExternalStore(vm.subscribe, vm.getSnapshot);
  const [url, setUrl] = useState(state.baseUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [register, setRegister] = useState(false);
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={{ marginTop: 30, gap: 10 }}><Text style={styles.eyebrow}>DIRECTORIO / MOBILE</Text>
        <Text style={styles.title}>{register ? 'Tu cuenta,\ntu espacio.' : 'Todo tu equipo,\na mano.'}</Text>
        <Text style={styles.muted}>Personas, perfiles y una conexión segura a tu API.</Text></View>
      <View style={styles.card}>
        <Text style={styles.heading}>{register ? 'Crear una cuenta' : 'Bienvenido'}</Text>
        {register && <Field label="Nombre" value={nombre} onChangeText={setNombre} maxLength={100} autoComplete="name" editable={!state.busy} />}
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} editable={!state.busy} />
        <Field label={register ? 'Contraseña · mínimo 12 caracteres' : 'Contraseña'} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={register ? 'new-password' : 'current-password'} editable={!state.busy} />
        <Feedback error={state.error} />
        <Button title={state.busy ? 'Conectando…' : register ? 'Registrarme' : 'Iniciar sesión'} disabled={state.busy || !email || !password || (register && (!nombre.trim() || password.length < 12))}
          onPress={() => { void vm.login(url, email, password, register ? nombre : undefined); }} />
        <Button secondary title={register ? 'Ya tengo una cuenta' : 'Crear cuenta USER'} disabled={state.busy} onPress={() => { setRegister(!register); setPassword(''); }} />
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Conexión</Text>
        <Field label="Dirección del backend" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!state.busy} />
        <Text style={styles.muted}>Teléfono: usa la IP Wi-Fi de tu PC, por ejemplo http://192.168.1.20:8080. Emulador Android: http://10.0.2.2:8080.</Text>
        <Text style={styles.muted}>HTTP se usa solo en la red local de clase. Para publicar la aplicación, conecta un servidor HTTPS.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
