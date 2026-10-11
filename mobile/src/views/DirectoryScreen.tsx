import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Text, View } from 'react-native';
import type { ApiClient } from '../data/ApiClient';
import { pickPhoto } from '../data/PhotoPicker';
import type { UsuariosViewModel } from '../viewmodels/UsuariosViewModel';
import { Button, colors, Feedback, styles } from './components';
import { NotificationsRepository } from '../data/NotificationsRepository';
import { NotificationsViewModel } from '../viewmodels/NotificationsViewModel';
import { NotificationsScreen } from './NotificationsScreen';
import { UserForm } from './UserForm';
export function DirectoryScreen({ vm, api, logout }: { vm: UsuariosViewModel; api: ApiClient; logout: () => void }) {
  const state = useSyncExternalStore(vm.subscribe, vm.getSnapshot);
  const [tab, setTab] = useState<'users' | 'profile'>('users');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useMemo(() => new NotificationsViewModel(new NotificationsRepository(api)), [api]);
  const [creating, setCreating] = useState(false);
  const [photoMissing, setPhotoMissing] = useState(false);
  const admin = state.profile.role === 'ADMIN';
  useEffect(() => { void vm.load(0); }, [vm]);
  useEffect(() => { setPhotoMissing(false); }, [state.photoVersion]);
  const close = () => { setCreating(false); vm.clearSelection(); };
  const header = <View style={{ gap: 18, marginBottom: 18 }}>
    <View style={styles.row}><Text style={[styles.eyebrow, { flex: 1 }]}>DIRECTORIO / MOBILE</Text><Text style={styles.tag}>{state.profile.role}</Text></View>
    <Text style={styles.title}>{admin && tab === 'users' ? 'Las personas\nhacen el equipo.' : 'Mi perfil'}</Text>
    <Text style={styles.muted}>Hola, {state.profile.nombre}. {admin ? 'Gestiona tu directorio desde aquí.' : 'Tu información y tu foto en un solo lugar.'}</Text>
    <View style={styles.row}>{admin && <><Button title="Usuarios" secondary={tab !== 'users'} onPress={() => setTab('users')} /><Button title="Mi perfil" secondary={tab !== 'profile'} onPress={() => setTab('profile')} /></>}<Button title="Salir" secondary onPress={logout} /></View>
    {admin && <Button title="Enviar correo" secondary onPress={() => setNotificationsOpen(true)} />}
    <Feedback error={state.error || state.profileError || state.listError} notice={state.notice} />
    {admin && tab === 'users' ? <>
      <View style={styles.card}>
        <View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>Directorio</Text><Button title="+ Crear" disabled={state.saving} onPress={() => { vm.clearSelection(); setCreating(true); }} /></View>
        <Text style={styles.muted}>Página {state.page + 1} · {state.users.length} personas en esta página</Text>
        <Button title={state.loading ? 'Actualizando…' : 'Actualizar en paralelo'} secondary disabled={state.loading || state.saving} onPress={() => { void vm.load(); }} />
        <Text style={styles.muted}>Perfil: {state.profileMs} ms · Lista: {state.listMs} ms{ '\n' }Tiempo total: {state.totalMs} ms · 2 consultas simultáneas</Text>
      </View>
      {state.loading && <ActivityIndicator color={colors.green} />}
    </> : <View style={styles.card}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        {photoMissing ? <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: '#E8F1ED', justifyContent: 'center', alignItems: 'center' }}><Text style={[styles.title, { color: colors.green }]}>{state.profile.nombre.slice(0, 1).toUpperCase()}</Text></View>
          : <Image accessibilityLabel="Foto de perfil" style={{ width: 112, height: 112, borderRadius: 56 }} source={{ uri: `${api.baseUrl}/api/usuarios/me/avatar?v=${state.photoVersion}`, headers: { Authorization: `Bearer ${api.token}` } }} onError={() => setPhotoMissing(true)} />}
        <Text style={styles.heading}>{state.profile.nombre}</Text><Text style={styles.text}>{state.profile.email}</Text><Text style={styles.tag}>{state.profile.role}</Text>
      </View>
      <Button title={state.saving ? 'Procesando foto…' : 'Subir foto de perfil'} disabled={state.saving} onPress={() => { void vm.upload(pickPhoto); }} />
      <Text style={styles.muted}>Selecciona una imagen. Se ajusta a 640 px, se envía como archivo y se guarda en la base de datos. Máximo en la API: 2 MB.</Text>
      <Text selectable style={styles.muted}>ID: {state.profile.id}{'\n'}Cuenta creada: {new Date(state.profile.createdAt).toLocaleDateString()}</Text>
      <Button title={state.loading ? 'Actualizando…' : 'Actualizar perfil'} secondary disabled={state.loading || state.saving} onPress={() => { void vm.load(); }} />
    </View>}
  </View>;
  if (notificationsOpen && admin) return <NotificationsScreen vm={notifications} close={() => setNotificationsOpen(false)} />;
  return <View style={styles.screen}>
    <FlatList contentContainerStyle={styles.content} data={admin && tab === 'users' ? state.users : []} keyExtractor={u => u.id}
      ListHeaderComponent={header} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshing={state.loading} onRefresh={() => { if (!state.saving) void vm.load(); }}
      ListEmptyComponent={admin && tab === 'users' && !state.loading ? <Text style={styles.muted}>No hay usuarios en esta página.</Text> : null}
      renderItem={({ item }) => <View style={styles.card}>
        <View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>{item.nombre}</Text><Text style={styles.tag}>{item.role}</Text></View>
        <Text style={styles.text}>{item.email}</Text><Text style={styles.muted}>Desde {new Date(item.createdAt).toLocaleDateString()}</Text>
        <View style={styles.row}>
          <Button title="Ver / editar" secondary disabled={state.saving} onPress={() => { void vm.select(item.id); }} />
          <Button title="Eliminar" danger disabled={state.saving || item.id === state.profile.id} onPress={() => Alert.alert('Eliminar usuario', `¿Eliminar a ${item.nombre}? También se borrará su foto.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => { void vm.remove(item.id); } }])} />
        </View>
      </View>}
      ListFooterComponent={admin && tab === 'users' ? <View style={[styles.row, { marginTop: 20 }]}><Button title="← Anterior" secondary disabled={state.page === 0 || state.loading || state.saving} onPress={() => { void vm.load(state.page - 1); }} /><Button title="Siguiente →" secondary disabled={!state.hasNext || state.loading || state.saving} onPress={() => { void vm.load(state.page + 1); }} /></View> : null}
    />
    {(creating || state.selected) && <UserForm key={state.selected?.id || 'new'} vm={vm} user={state.selected} close={close} />}
  </View>;
}
