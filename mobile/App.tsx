import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ApiClient } from './src/data/ApiClient';
import { UsuariosRepository } from './src/data/UsuariosRepository';
import { SessionStore } from './src/data/SessionStore';
import { SessionViewModel } from './src/viewmodels/SessionViewModel';
import { UsuariosViewModel } from './src/viewmodels/UsuariosViewModel';
import { AuthScreen } from './src/views/AuthScreen';
import { DirectoryScreen } from './src/views/DirectoryScreen';
import { colors, styles } from './src/views/components';
const api = new ApiClient();
const repository = new UsuariosRepository(api);
const session = new SessionViewModel(api, repository, new SessionStore());
export default function App() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const users = useMemo(() => state.user ? new UsuariosViewModel(repository, state.user) : null, [state.user]);
  useEffect(() => {
    void session.restore();
    const listener = AppState.addEventListener('change', status => { if (status === 'active') session.checkExpiry(); });
    return () => listener.remove();
  }, []);
  return <SafeAreaProvider><SafeAreaView style={styles.screen}><StatusBar style="dark" />
    {!state.ready ? <View style={[styles.content, { marginTop: 80 }]}><ActivityIndicator color={colors.green} /><Text style={styles.text}>Recuperando sesión…</Text></View>
      : users ? <DirectoryScreen vm={users} api={api} logout={() => { void session.logout(); }} /> : <AuthScreen vm={session} />}
  </SafeAreaView></SafeAreaProvider>;
}
