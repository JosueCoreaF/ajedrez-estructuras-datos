import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import supabase from '../utils/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthScreen({ onSignedIn, onBack }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    try {
      setLoading(true);
      setStatus('Registrando...');
      if (supabase.auth && typeof supabase.auth.signUp === 'function') {
        const res = await supabase.auth.signUp({ email, password }, { data: { full_name: fullName } });
        if (res.error) {
          setStatus(res.error.message || 'Error registrando');
        } else {
          const user = res.data?.user || null;
          if (user) {
            try { await AsyncStorage.setItem('current_user', JSON.stringify(user)); } catch (e) { console.warn('save user error', e); }
          }
          setStatus('Registro correcto');
          if (onSignedIn) onSignedIn(user);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) setStatus(error.message || 'Error registrando');
        else { const user = data?.user || null; if (user) { try { await AsyncStorage.setItem('current_user', JSON.stringify(user)); } catch(_){} } if (onSignedIn) onSignedIn(user); }
      }
    } catch (e) {
      setStatus(String(e));
    } finally { setLoading(false); }
  }

  async function handleSignIn() {
    try {
      setLoading(true);
      setStatus('Iniciando sesión...');
      if (supabase.auth && typeof supabase.auth.signInWithPassword === 'function') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setStatus(error.message || 'Error iniciando sesión');
        else {
          const user = data.user || null;
          if (user) {
            try { await AsyncStorage.setItem('current_user', JSON.stringify(user)); } catch (e) { console.warn('save user error', e); }
          }
          setStatus('Sesión iniciada');
          if (onSignedIn) onSignedIn(user);
        }
      } else if (supabase.auth && typeof supabase.auth.signIn === 'function') {
        const { user, session, error } = await supabase.auth.signIn({ email, password });
        if (error) setStatus(error.message || 'Error iniciando sesión');
        else { if (onSignedIn) onSignedIn(user || null); }
      } else {
        setStatus('Auth API no disponible');
      }
    } catch (e) {
      setStatus(String(e));
    } finally { setLoading(false); }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('current_user');
      setStatus('Sesión cerrada');
      if (onSignedIn) onSignedIn(null);
    } catch (e) {
      setStatus('Error cerrando sesión: ' + String(e));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, mode === 'login' ? styles.tabActive : null]} onPress={() => setMode('login')}>
          <Text style={[styles.tabText, mode === 'login' ? styles.tabTextActive : null]}>Iniciar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'register' ? styles.tabActive : null]} onPress={() => setMode('register')}>
          <Text style={[styles.tabText, mode === 'register' ? styles.tabTextActive : null]}>Registrarse</Text>
        </TouchableOpacity>
      </View>

      {mode === 'register' ? (
        <TextInput placeholder="Nombre completo" value={fullName} onChangeText={setFullName} style={styles.inputMinimal} />
      ) : null}

      <TextInput placeholder="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.inputMinimal} />
      <TextInput placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} style={styles.inputMinimal} />

      <TouchableOpacity style={styles.primaryBtn} onPress={mode === 'login' ? handleSignIn : handleSignUp} disabled={loading}>
        <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</Text>
      </TouchableOpacity>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  tabRow: { flexDirection: 'row', marginBottom: 20, alignSelf: 'center', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f2f2f2' },
  tab: { paddingVertical: 10, paddingHorizontal: 18 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#111' },
  inputMinimal: { width: '100%', borderBottomWidth: 1, borderColor: '#e6e6e6', paddingVertical: 10, marginBottom: 14, fontSize: 16 },
  primaryBtn: { marginTop: 8, backgroundColor: '#1f6feb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  linkBtn: { marginTop: 12, alignItems: 'center' },
  linkText: { color: '#666' },
  ghostBtn: { marginTop: 8, alignItems: 'center' },
  ghostText: { color: '#b00' },
  status: { marginTop: 14, color: '#333', textAlign: 'center' }
});
